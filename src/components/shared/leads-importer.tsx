"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Upload, FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importLeadsFromCsvAction } from "@/app/actions/campaigns";
import { normalizePhoneNumber } from "@/lib/utils";
import { csvToRecords } from "@/lib/utils/csv";

interface LeadsImporterProps {
  campaignId: string;
  onImported?: () => void;
}

interface ParsedLead {
  name?: string;
  phone: string;
  company?: string;
  email?: string;
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_LEADS = 5000;

function extractLeads(content: string): ParsedLead[] {
  const records = csvToRecords(content);
  const leads: ParsedLead[] = [];
  for (const row of records) {
    const phoneRaw =
      row.telephone ||
      row["téléphone"] ||
      row.phone ||
      row.tel ||
      row.mobile ||
      row["numéro"] ||
      row.numero ||
      "";
    if (!phoneRaw) continue;

    const normalized = normalizePhoneNumber(phoneRaw, "TG") ?? phoneRaw;

    leads.push({
      name:
        row.nom ||
        row.name ||
        row["prénom"] ||
        row.prenom ||
        row["full_name"] ||
        undefined,
      phone: normalized,
      company:
        row.entreprise ||
        row.company ||
        row["société"] ||
        row.societe ||
        undefined,
      email: row.email || row.mail || undefined,
    });

    if (leads.length >= MAX_LEADS) break;
  }
  return leads;
}

export function LeadsImporter({ campaignId, onImported }: LeadsImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedLead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function readFileAsText(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(String(e.target?.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(f, "utf-8");
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (
      !selectedFile.name.toLowerCase().endsWith(".csv") &&
      selectedFile.type !== "text/csv"
    ) {
      toast.error("Seuls les fichiers CSV sont acceptés.");
      return;
    }

    if (selectedFile.size > MAX_BYTES) {
      toast.error("Fichier trop volumineux (5 MB max).");
      return;
    }

    try {
      const content = await readFileAsText(selectedFile);
      const parsed = extractLeads(content);

      if (parsed.length === 0) {
        toast.error("Aucun lead valide trouvé. Vérifiez le format du CSV.");
        return;
      }

      setFile(selectedFile);
      setPreview(parsed.slice(0, 5));
      setTotalCount(parsed.length);
      toast.success(`${parsed.length} lead(s) détecté(s). Prêt à importer.`);
    } catch (err) {
      toast.error("Erreur de lecture du fichier.");
      console.error(err);
    }
  }

  function handleImport() {
    if (!file) return;

    startTransition(async () => {
      try {
        const content = await readFileAsText(file);
        const leads = extractLeads(content);

        const result = await importLeadsFromCsvAction(campaignId, leads);

        if (result.error) {
          toast.error(result.error);
          return;
        }

        const dupMsg =
          result.duplicates && result.duplicates > 0
            ? ` (${result.duplicates} doublon(s) ignoré(s))`
            : "";
        toast.success(
          `${result.count} lead(s) importé(s) avec succès !${dupMsg}`
        );
        setFile(null);
        setPreview([]);
        setTotalCount(0);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onImported?.();
      } catch (err) {
        toast.error("Erreur lors de l'import.");
        console.error(err);
      }
    });
  }

  function clearFile() {
    setFile(null);
    setPreview([]);
    setTotalCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => fileInputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 hover:border-primary/50 hover:bg-accent/50 transition-colors"
      >
        <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm font-medium">Cliquez pour sélectionner un CSV</p>
        <p className="text-xs text-muted-foreground mt-1">
          Colonnes attendues : nom, téléphone (requis), entreprise, email
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {file && (
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium truncate max-w-[200px]">
              {file.name}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">
              {totalCount} lead{totalCount > 1 ? "s" : ""}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={clearFile}
            aria-label="Retirer le fichier"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {preview.length > 0 && (
        <div className="rounded-md border p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Aperçu :
          </p>
          {preview.map((lead, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              {lead.name ?? "—"} · {lead.phone}
              {lead.company ? ` · ${lead.company}` : ""}
            </div>
          ))}
        </div>
      )}

      {file && (
        <Button
          onClick={handleImport}
          disabled={isPending}
          className="w-full gap-2"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Importer {totalCount} lead{totalCount > 1 ? "s" : ""}
        </Button>
      )}
    </div>
  );
}
