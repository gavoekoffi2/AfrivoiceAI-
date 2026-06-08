import { normalizePhoneNumber } from "./utils";

export type ProspectingLeadInput = {
  name?: string;
  phone: string;
  company?: string;
  email?: string;
};

export type ProspectingOutcome =
  | "qualified"
  | "callback"
  | "not_interested"
  | "no_answer";

export type ParsedLeadsCsvResult = {
  validLeads: ProspectingLeadInput[];
  invalidRows: number;
  duplicates: number;
};

function stripValue(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/^['"]|['"]$/g, "").trim();
  return cleaned ? cleaned : undefined;
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^['"]|['"]$/g, "")
    .replace(/\s+/g, "_");
}

function detectDelimiter(headerLine: string): string {
  const candidates = [";", ",", "\t"];
  return candidates.reduce((best, delimiter) =>
    headerLine.split(delimiter).length > headerLine.split(best).length
      ? delimiter
      : best
  );
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function pick(row: Record<string, string | undefined>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = stripValue(row[key]);
    if (value) return value;
  }
  return undefined;
}

export function parseLeadsCsv(
  content: string,
  defaultCountry = "TG"
): ParsedLeadsCsvResult {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { validLeads: [], invalidRows: lines.length, duplicates: 0 };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitDelimitedLine(lines[0], delimiter).map(normalizeHeader);
  const seenPhones = new Set<string>();
  const validLeads: ProspectingLeadInput[] = [];
  let invalidRows = 0;
  let duplicates = 0;

  for (const line of lines.slice(1)) {
    const values = splitDelimitedLine(line, delimiter);
    const row = headers.reduce<Record<string, string | undefined>>((acc, header, index) => {
      acc[header] = values[index];
      return acc;
    }, {});

    const rawPhone = pick(row, [
      "telephone",
      "phone",
      "tel",
      "mobile",
      "numero",
      "numero_telephone",
      "whatsapp",
    ]);
    const phone = rawPhone ? normalizePhoneNumber(rawPhone, defaultCountry) : null;

    if (!phone) {
      invalidRows++;
      continue;
    }

    if (seenPhones.has(phone)) {
      duplicates++;
      continue;
    }
    seenPhones.add(phone);

    validLeads.push({
      name: pick(row, ["nom", "name", "prenom", "fullname", "contact"]),
      phone,
      company: pick(row, ["entreprise", "company", "societe", "business"]),
      email: pick(row, ["email", "mail", "e_mail"]),
    });
  }

  return { validLeads, invalidRows, duplicates };
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

export function classifyProspectingOutcome(params: {
  summary?: string | null;
  transcript?: string | null;
  endedReason?: string | null;
}): ProspectingOutcome {
  const combined = `${params.summary ?? ""} ${params.transcript ?? ""} ${
    params.endedReason ?? ""
  }`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    includesAny(combined, [
      "no-answer",
      "no answer",
      "pas de reponse",
      "messagerie",
      "voicemail",
      "occupe",
      "unreachable",
      "did not answer",
    ])
  ) {
    return "no_answer";
  }

  if (
    includesAny(combined, [
      "pas interesse",
      "pas interessee",
      "n'est pas interesse",
      "nest pas interesse",
      "ne souhaite pas",
      "refuse",
      "a refuse",
      "mauvais numero",
      "wrong number",
      "ne plus rappeler",
    ])
  ) {
    return "not_interested";
  }

  if (
    includesAny(combined, [
      "interesse",
      "interessee",
      "qualifie",
      "qualifiee",
      "rendez-vous",
      "rdv",
      "demo",
      "demonstration",
      "envoyez",
      "whatsapp",
      "email",
      "besoin",
      "budget",
    ])
  ) {
    return "qualified";
  }

  if (
    includesAny(combined, [
      "rappeler",
      "rappelez",
      "callback",
      "call back",
      "plus tard",
      "demain",
      "pas disponible",
      "indisponible",
    ])
  ) {
    return "callback";
  }

  return "not_interested";
}

export function buildProspectingFirstMessage(params: {
  leadName?: string | null;
  companyName?: string | null;
}) {
  if (params.leadName) {
    return `Bonjour ${params.leadName}, comment allez-vous ? Je serai bref.`;
  }

  if (params.companyName) {
    return `Bonjour, je cherche à joindre la personne qui s'occupe de ${params.companyName}. Je serai bref.`;
  }

  return "Bonjour, comment allez-vous ? Je serai bref.";
}
