"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Upload, FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importLeadsFromCsvAction } from "@/app/actions/campaigns";
import { parseLeadsCsv, type ProspectingLeadInput } from "@/lib/prospecting";

interface LeadsImporterProps {
  campaignId: string;
}

type ParsedLead = ProspectingLeadInput;

export function LeadsImporter({ campaignId }: LeadsImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedLead[]>([]);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function parseCsv(content: string): ParsedLead[] {
    const result = parseLeadsCsv(content, "TG");

    if (result.invalidRows > 0 || result.duplicates > 0) {
      toast.info(
        `${result.validLeads.length} lead(s) valides, ${result.duplicates} doublon(s), ${result.invalidRows} ligne(s) ignorée(s).`
      );
    }

    return result.validLeads;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Seuls les fichiers CSV sont acceptés.");
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCsv(content);
      setPreview(parsed.slice(0, 5));

      if (parsed.length === 0) {
        toast.error(
          "Aucun lead valide trouvé. Vérifiez le format du fichier CSV."
        );
        setFile(null);
      } else {
        toast.success(
          `${parsed.length} lead(s) détecté(s). Prêt à importer.`
        );
      }
    };
    reader.readAsText(selectedFile);
  }

  function handleImport() {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const leads = parseCsv(content);

      startTransition(async () => {
        const result = await importLeadsFromCsvAction(campaignId, leads);

        if (result.error) {
          toast.error(result.error);
          return;
        }

        toast.success(
          `${result.count} lead(s) importés avec succès${
            result.skipped ? `, ${result.skipped} ignoré(s)` : ""
          } !`
        );
        setFile(null);
        setPreview([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      });
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-3">
      {/* Zone de dépôt */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 hover:border-primary/50 hover:bg-accent/50 transition-colors"
      >
        <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm font-medium">Cliquez pour sélectionner un CSV</p>
        <p className="text-xs text-muted-foreground mt-1">
          Colonnes attendues : nom, téléphone, entreprise
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Fichier sélectionné */}
      {file && (
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium truncate max-w-[200px]">
              {file.name}
            </span>
            <span className="text-xs text-muted-foreground">
              ({preview.length > 0 ? `~${preview.length}+ leads` : "0 leads"})
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setFile(null);
              setPreview([]);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Aperçu */}
      {preview.length > 0 && (
        <div className="rounded-md border p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Aperçu (5 premiers leads) :
          </p>
          {preview.map((lead, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              {lead.name ?? "—"} · {lead.phone}
              {lead.company ? ` · ${lead.company}` : ""}
            </div>
          ))}
        </div>
      )}

      {/* Bouton d'import */}
      {file && (
        <Button
          onClick={handleImport}
          disabled={isPending}
          className="w-full gap-2"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Importer les leads
        </Button>
      )}
    </div>
  );
}
