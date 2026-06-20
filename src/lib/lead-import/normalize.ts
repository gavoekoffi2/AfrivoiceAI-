export type RawImportRow = Record<string, unknown>;

export type NormalizedLeadDatabaseRecord = {
  companyName: string;
  contactName: string | null;
  sector: string | null;
  country: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  opportunityScore: number;
  priorityBand: "A" | "B" | "C";
  recommendedOffer: string | null;
  outreachAngle: string | null;
  aiEmail: string | null;
  aiCallScript: string | null;
  rawPayload: RawImportRow;
};

export type LeadImportStats = {
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  withPhone: number;
  withEmail: number;
  priorityA: number;
  priorityB: number;
  priorityC: number;
  detectedColumns: Record<string, string | null>;
  rejected: Array<{ rowIndex: number; reason: string; row: RawImportRow }>;
};

const FIELD_ALIASES = {
  companyName: [
    "company_name",
    "company",
    "entreprise",
    "clinique",
    "cabinet",
    "practice_name",
    "nom_clinique",
    "nom_entreprise",
    "organization",
    "organisation",
    "nom_cabinet",
  ],
  contactName: [
    "contact_name",
    "contact",
    "nom",
    "nom_medecin",
    "medecin",
    "médecin",
    "doctor",
    "physician",
    "dr",
    "responsable",
  ],
  sector: ["sector", "secteur", "specialite", "spécialité", "specialty", "domaine", "record_sector"],
  country: ["country", "pays", "record_country"],
  city: ["city", "ville", "localite", "localité", "locality", "record_city"],
  phone: [
    "phone",
    "telephone",
    "téléphone",
    "tel",
    "mobile",
    "cell",
    "numero",
    "numéro",
    "phone_public",
    "telephone_public",
    "téléphone_public",
  ],
  email: ["email", "mail", "courriel", "email_public", "e-mail"],
  website: ["website", "site", "site_web", "url", "web", "formulaire_contact"],
  address: ["address", "adresse", "location", "lieu", "practice_address"],
  sourceUrl: ["source_url", "url_source", "profil", "profile_url", "url_profil_officiel"],
  sourceName: ["source", "source_name", "college", "collège", "registre", "source_officielle"],
  opportunityScore: ["score", "opportunity_score", "priorite_score", "priorité_score"],
  priorityBand: ["priority", "priority_band", "priorite", "priorité", "priorite_commerciale", "priorité_commerciale"],
  recommendedOffer: ["recommended_offer", "offre", "offre_recommandee", "offre_ia_recommandee"],
  outreachAngle: ["angle", "outreach_angle", "angle_message", "angle_approche"],
  aiEmail: ["ai_email", "email_ia", "message_email", "message"],
  aiCallScript: ["ai_call_script", "script_appel", "call_script", "script_ia"],
} as const;

type CanonicalField = keyof typeof FIELD_ALIASES;

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cleanString(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function detectColumns(rows: RawImportRow[]) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const normalizedHeaders = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const detected = {} as Record<CanonicalField, string | null>;

  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as Array<[
    CanonicalField,
    readonly string[],
  ]>) {
    detected[field] = null;
    for (const alias of aliases) {
      const originalHeader = normalizedHeaders.get(normalizeHeader(alias));
      if (originalHeader) {
        detected[field] = originalHeader;
        break;
      }
    }
  }

  return detected;
}

function getValue(row: RawImportRow, detected: Record<CanonicalField, string | null>, field: CanonicalField) {
  const column = detected[field];
  const directValue = column ? cleanString(row[column]) : null;
  if (directValue) return directValue;

  const normalizedRowHeaders = new Map(Object.keys(row).map((header) => [normalizeHeader(header), header]));
  for (const alias of FIELD_ALIASES[field]) {
    const rowColumn = normalizedRowHeaders.get(normalizeHeader(alias));
    const value = rowColumn ? cleanString(row[rowColumn]) : null;
    if (value) return value;
  }

  return null;
}

function normalizeCountry(value: string | null, fallbackCountry: string) {
  const country = (value || fallbackCountry || "TG").trim().toUpperCase();
  if (["CANADA", "CA", "CAN"].includes(country)) return "CA";
  if (["TOGO", "TG"].includes(country)) return "TG";
  if (["CAMEROUN", "CM"].includes(country)) return "CM";
  if (["BENIN", "BÉNIN", "BJ"].includes(country)) return "BJ";
  return country.slice(0, 2);
}

function normalizePriority(value: string | null, row: { phone: string | null; email: string | null; website: string | null; country: string; city: string | null }) {
  const explicit = value?.trim().toUpperCase();
  if (explicit === "A" || explicit === "B" || explicit === "C") return explicit;

  const city = (row.city || "").toLowerCase();
  const francophoneSignal =
    row.country === "CA" &&
    /qu[eé]bec|montr[eé]al|laval|gatineau|sherbrooke|trois-rivi[eè]res|quebec|moncton|dieppe|edmundston|bathurst|ottawa|sudbury|saint-boniface|winnipeg/.test(city);

  if (row.phone && (row.email || row.website) && francophoneSignal) return "A";
  if (row.phone && (row.email || row.website)) return "B";
  return "C";
}

function normalizeScore(value: string | null, priorityBand: "A" | "B" | "C") {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, parsed));
  if (priorityBand === "A") return 90;
  if (priorityBand === "B") return 72;
  return 45;
}

export function normalizeLeadImportRows(
  rows: RawImportRow[],
  options: { defaultCountry?: string; defaultSector?: string; sourceName?: string } = {}
): { records: NormalizedLeadDatabaseRecord[]; stats: LeadImportStats } {
  const detected = detectColumns(rows);
  const records: NormalizedLeadDatabaseRecord[] = [];
  const rejected: LeadImportStats["rejected"] = [];

  rows.forEach((row, index) => {
    const contactName = getValue(row, detected, "contactName");
    const companyName = getValue(row, detected, "companyName") || contactName;
    const phone = getValue(row, detected, "phone");
    const email = getValue(row, detected, "email");
    const website = getValue(row, detected, "website");

    if (!companyName) {
      rejected.push({ rowIndex: index + 2, reason: "Nom entreprise/clinique ou contact manquant", row });
      return;
    }

    if (!phone && !email && !website) {
      rejected.push({ rowIndex: index + 2, reason: "Aucun contact exploitable: téléphone, email ou site/formulaire requis", row });
      return;
    }

    const city = getValue(row, detected, "city");
    const country = normalizeCountry(getValue(row, detected, "country"), options.defaultCountry ?? "TG");
    const priorityBand = normalizePriority(getValue(row, detected, "priorityBand"), {
      phone,
      email,
      website,
      country,
      city,
    });
    const opportunityScore = normalizeScore(getValue(row, detected, "opportunityScore"), priorityBand);

    records.push({
      companyName,
      contactName,
      sector: getValue(row, detected, "sector") || options.defaultSector || null,
      country,
      city,
      phone,
      email,
      website,
      address: getValue(row, detected, "address"),
      sourceUrl: getValue(row, detected, "sourceUrl"),
      sourceName: getValue(row, detected, "sourceName") || options.sourceName || null,
      opportunityScore,
      priorityBand,
      recommendedOffer: getValue(row, detected, "recommendedOffer"),
      outreachAngle: getValue(row, detected, "outreachAngle"),
      aiEmail: getValue(row, detected, "aiEmail"),
      aiCallScript: getValue(row, detected, "aiCallScript"),
      rawPayload: row,
    });
  });

  return {
    records,
    stats: {
      totalRows: rows.length,
      acceptedRows: records.length,
      rejectedRows: rejected.length,
      withPhone: records.filter((record) => record.phone).length,
      withEmail: records.filter((record) => record.email).length,
      priorityA: records.filter((record) => record.priorityBand === "A").length,
      priorityB: records.filter((record) => record.priorityBand === "B").length,
      priorityC: records.filter((record) => record.priorityBand === "C").length,
      detectedColumns: detected,
      rejected,
    },
  };
}
