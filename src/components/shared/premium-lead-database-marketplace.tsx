"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Database,
  Globe2,
  Layers3,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateCampaignFromDatabaseForm } from "@/components/shared/create-campaign-from-database-form";
import { PurchaseLeadDatabaseButton } from "@/components/shared/purchase-lead-database-button";

export type PremiumLeadDatabase = {
  id: string;
  name: string;
  sector: string;
  country: string;
  city: string | null;
  description: string;
  priceFcfa: number;
  recordCount: number;
  qualityScore: number;
  dataSource: string;
  allowedUsage: string;
  sampleRecords: SampleRecord[];
  isPurchased: boolean;
  previewRecords: PreviewRecord[];
};

type SampleRecord = {
  company?: string;
  city?: string;
  sector?: string;
};

type PreviewRecord = {
  id: string;
  companyName: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  opportunityScore: number;
  outreachAngle: string | null;
};

type MarketplaceProps = {
  databases: PremiumLeadDatabase[];
};

const COUNTRY_META: Record<string, { name: string; flag: string; accent: string }> = {
  TG: { name: "Togo", flag: "🇹🇬", accent: "from-emerald-400/30 to-lime-400/10" },
  CM: { name: "Cameroun", flag: "🇨🇲", accent: "from-amber-400/30 to-emerald-400/10" },
  BJ: { name: "Bénin", flag: "🇧🇯", accent: "from-yellow-400/30 to-rose-400/10" },
};

function formatFcfa(value: string | number) {
  return `${Number(value).toLocaleString("fr-FR")} FCFA`;
}

function countryLabel(code: string) {
  return COUNTRY_META[code]?.name ?? code;
}

function countryFlag(code: string) {
  return COUNTRY_META[code]?.flag ?? "🌍";
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "fr")
  );
}

export function PremiumLeadDatabaseMarketplace({ databases }: MarketplaceProps) {
  const [query, setQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedSector, setSelectedSector] = useState("all");

  const countries = useMemo(() => uniqueSorted(databases.map((item) => item.country)), [databases]);
  const sectors = useMemo(() => uniqueSorted(databases.map((item) => item.sector)), [databases]);

  const totalRecords = useMemo(
    () => databases.reduce((sum, item) => sum + item.recordCount, 0),
    [databases]
  );
  const purchasedCount = databases.filter((item) => item.isPurchased).length;

  const countryStats = useMemo(
    () =>
      countries.map((country) => {
        const items = databases.filter((item) => item.country === country);
        return {
          country,
          packs: items.length,
          records: items.reduce((sum, item) => sum + item.recordCount, 0),
          unlocked: items.filter((item) => item.isPurchased).length,
        };
      }),
    [countries, databases]
  );

  const filteredDatabases = useMemo(() => {
    const q = normalize(query.trim());
    return databases.filter((database) => {
      const matchesCountry = selectedCountry === "all" || database.country === selectedCountry;
      const matchesSector = selectedSector === "all" || database.sector === selectedSector;
      const searchable = normalize(
        [
          database.name,
          database.country,
          countryLabel(database.country),
          database.city ?? "",
          database.sector,
          database.description,
          database.dataSource,
        ].join(" ")
      );
      return matchesCountry && matchesSector && (!q || searchable.includes(q));
    });
  }, [databases, query, selectedCountry, selectedSector]);

  const groupedByCountry = useMemo(() => {
    const groups = new Map<string, PremiumLeadDatabase[]>();
    for (const database of filteredDatabases) {
      const current = groups.get(database.country) ?? [];
      current.push(database);
      groups.set(database.country, current);
    }
    return Array.from(groups.entries()).sort(([a], [b]) =>
      countryLabel(a).localeCompare(countryLabel(b), "fr")
    );
  }, [filteredDatabases]);

  const resetFilters = () => {
    setQuery("");
    setSelectedCountry("all");
    setSelectedSector("all");
  };

  return (
    <div className="min-h-full bg-[#08090a] text-[#f7f8f8]">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top_left,rgba(113,112,255,0.28),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_30%)]" />
      <div className="relative mx-auto max-w-7xl space-y-8 px-4 py-6 md:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/40 backdrop-blur">
          <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[1.25fr_0.75fr] lg:p-10">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-[#d0d6e0]">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                  Marketplace prospects premium
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs font-medium text-violet-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  IA + scoring + scripts d&apos;appel
                </span>
              </div>

              <div className="space-y-3">
                <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-white md:text-6xl">
                  Bases de prospects classées par pays et par domaine.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[#a7adb8] md:text-lg">
                  Le client choisit un pays, filtre par secteur, recherche une base précise,
                  achète l&apos;accès puis transforme la base en campagne AfrivoiceAI.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard icon={Database} label="Packs publiés" value={databases.length.toLocaleString("fr-FR")} />
                <MetricCard icon={Target} label="Prospects disponibles" value={totalRecords.toLocaleString("fr-FR")} />
                <MetricCard icon={Lock} label="Bases débloquées" value={`${purchasedCount}/${databases.length}`} />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#0f1011]/80 p-4 shadow-inner shadow-black/30">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#62666d]">Pays actifs</p>
                  <h2 className="text-lg font-medium">Catalogue Afrique</h2>
                </div>
                <Globe2 className="h-5 w-5 text-violet-200" />
              </div>
              <div className="space-y-3">
                {countryStats.map((stat) => (
                  <button
                    key={stat.country}
                    type="button"
                    onClick={() => setSelectedCountry(stat.country)}
                    className={`group w-full rounded-2xl border p-4 text-left transition hover:border-violet-300/40 hover:bg-white/[0.06] ${
                      selectedCountry === stat.country
                        ? "border-violet-300/40 bg-violet-400/10"
                        : "border-white/10 bg-white/[0.025]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${COUNTRY_META[stat.country]?.accent ?? "from-violet-400/20 to-white/5"} text-xl`}>
                          {countryFlag(stat.country)}
                        </span>
                        <div>
                          <p className="font-medium text-white">{countryLabel(stat.country)}</p>
                          <p className="text-xs text-[#8a8f98]">
                            {stat.packs} domaines · {stat.unlocked} débloqués
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm text-[#f7f8f8]">{stat.records.toLocaleString("fr-FR")}</p>
                        <p className="text-[11px] text-[#62666d]">prospects</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="sticky top-0 z-10 rounded-3xl border border-white/10 bg-[#0f1011]/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#62666d]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher: pays, domaine, source, pack..."
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-10 text-sm text-white outline-none ring-0 placeholder:text-[#62666d] transition focus:border-violet-300/50 focus:bg-white/[0.06]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#8a8f98] hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>

            <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
              <FilterChip active={selectedCountry === "all"} onClick={() => setSelectedCountry("all")}>Tous pays</FilterChip>
              {countries.map((country) => (
                <FilterChip key={country} active={selectedCountry === country} onClick={() => setSelectedCountry(country)}>
                  {countryFlag(country)} {countryLabel(country)}
                </FilterChip>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={resetFilters}
              className="h-12 rounded-2xl border-white/10 bg-white/[0.03] text-[#d0d6e0] hover:bg-white/[0.08] hover:text-white"
            >
              Réinitialiser
            </Button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <FilterChip active={selectedSector === "all"} onClick={() => setSelectedSector("all")}>
              <Layers3 className="h-3.5 w-3.5" /> Tous domaines
            </FilterChip>
            {sectors.map((sector) => (
              <FilterChip key={sector} active={selectedSector === sector} onClick={() => setSelectedSector(sector)}>
                {sector}
              </FilterChip>
            ))}
          </div>
        </section>

        <section className="space-y-8">
          {filteredDatabases.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center">
              <Database className="mx-auto mb-4 h-12 w-12 text-[#62666d]" />
              <h3 className="text-xl font-semibold">Aucune base ne correspond aux filtres.</h3>
              <p className="mt-2 text-[#8a8f98]">Change le pays, le domaine ou le mot-clé recherché.</p>
              <Button onClick={resetFilters} className="mt-5 rounded-xl bg-[#5e6ad2] hover:bg-[#7170ff]">
                Voir tout le catalogue
              </Button>
            </div>
          ) : (
            groupedByCountry.map(([country, items]) => (
              <div key={country} className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-[#62666d]">Pays</p>
                    <h2 className="flex items-center gap-3 text-2xl font-semibold tracking-[-0.03em]">
                      <span>{countryFlag(country)}</span>
                      {countryLabel(country)}
                    </h2>
                  </div>
                  <p className="text-sm text-[#8a8f98]">
                    {items.length} packs · {items.reduce((sum, item) => sum + item.recordCount, 0).toLocaleString("fr-FR")} prospects
                  </p>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {items.map((database) => (
                    <DatabaseCard key={database.id} database={database} />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Database;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-violet-100">
        <Icon className="h-4 w-4" />
      </div>
      <p className="font-mono text-2xl font-semibold tracking-[-0.04em] text-white">{value}</p>
      <p className="text-xs text-[#8a8f98]">{label}</p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition ${
        active
          ? "border-violet-300/50 bg-violet-400/15 text-white shadow-lg shadow-violet-950/20"
          : "border-white/10 bg-white/[0.025] text-[#a7adb8] hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function DatabaseCard({ database }: { database: PremiumLeadDatabase }) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-white/10 bg-[#0f1011] shadow-xl shadow-black/25 transition hover:-translate-y-0.5 hover:border-violet-300/30 hover:bg-[#121316]">
      <div className="border-b border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-white/10 bg-white/[0.06] text-[#d0d6e0] hover:bg-white/[0.06]">
                {countryFlag(database.country)} {countryLabel(database.country)}
              </Badge>
              <Badge className="border-violet-300/20 bg-violet-400/10 text-violet-100 hover:bg-violet-400/10">
                {database.sector}
              </Badge>
              <Badge variant={database.isPurchased ? "success" : "secondary"} className={database.isPurchased ? "" : "bg-amber-400/10 text-amber-100 hover:bg-amber-400/10"}>
                {database.isPurchased ? "Débloquée" : "Premium"}
              </Badge>
            </div>
            <div>
              <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">{database.name}</h3>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#8a8f98]">{database.description}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
            <p className="text-[11px] text-[#62666d]">Prix</p>
            <p className="font-mono text-sm font-semibold text-white">{formatFcfa(database.priceFcfa)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Prospects" value={database.recordCount.toLocaleString("fr-FR")} />
          <MiniStat label="Qualité" value={`${database.qualityScore}/100`} icon={BarChart3} />
          <MiniStat label="Zone" value={database.city || countryLabel(database.country)} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-[#f7f8f8]">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            Usage & source
          </div>
          <p className="mt-2 text-sm leading-6 text-[#8a8f98]">{database.allowedUsage}</p>
          <p className="mt-3 text-xs text-[#62666d]">Source: {database.dataSource}</p>
        </div>

        {!database.isPurchased && database.sampleRecords.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[#d0d6e0]">Aperçu avant achat</span>
              <span className="text-xs text-[#62666d]">contacts masqués</span>
            </div>
            {database.sampleRecords.slice(0, 3).map((record, index) => (
              <div
                key={`${database.id}-sample-${index}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-[#f7f8f8]">{record.company ?? "Entreprise premium"}</p>
                  <p className="text-xs text-[#62666d]">{record.city ?? database.city ?? countryLabel(database.country)}</p>
                </div>
                <Lock className="h-4 w-4 shrink-0 text-[#62666d]" />
              </div>
            ))}
          </div>
        )}

        {database.isPurchased && (
          <div className="space-y-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
              Meilleurs prospects débloqués
            </div>
            {database.previewRecords.length === 0 ? (
              <p className="text-sm text-[#8a8f98]">Base débloquée, mais aucun prospect détaillé n&apos;est encore importé.</p>
            ) : (
              <div className="space-y-2">
                {database.previewRecords.map((record) => (
                  <div key={record.id} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-white">{record.companyName}</span>
                      <Badge variant="outline" className="border-white/10 text-[#d0d6e0]">Score {record.opportunityScore}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-[#8a8f98]">
                      {[record.city, record.phone, record.email].filter(Boolean).join(" · ")}
                    </p>
                    {record.outreachAngle && <p className="mt-2 text-xs leading-5 text-[#d0d6e0]">Angle: {record.outreachAngle}</p>}
                  </div>
                ))}
              </div>
            )}
            <CreateCampaignFromDatabaseForm
              databaseId={database.id}
              databaseName={database.name}
              disabled={database.previewRecords.length === 0}
            />
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <PurchaseLeadDatabaseButton
            databaseId={database.id}
            isPurchased={database.isPurchased}
            priceFcfa={database.priceFcfa}
          />
          <div className="hidden items-center gap-1 text-xs text-[#62666d] sm:flex">
            Voir détails <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </article>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof BarChart3;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
      <p className="text-[11px] text-[#62666d]">{label}</p>
      <p className="mt-1 flex items-center gap-1 truncate font-mono text-sm font-semibold text-white">
        {Icon && <Icon className="h-3.5 w-3.5 text-violet-200" />}
        {value}
      </p>
    </div>
  );
}
