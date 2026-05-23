/**
 * Parseur CSV robuste : gère les guillemets, échappements de virgules,
 * sauts de ligne dans les champs, et le BOM UTF-8.
 *
 * Pas de dépendance externe (PapaParse pèse 60kb).
 */
export function parseCsv(input: string): string[][] {
  // Retirer BOM UTF-8
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const len = input.length;

  while (i < len) {
    const c = input[i];

    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }

    if (c === "\r") {
      i++;
      continue; // ignore CR, le LF gère la fin de ligne
    }

    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }

    field += c;
    i++;
  }

  // Dernière cellule / ligne
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/**
 * Convertit un CSV en tableau d'objets en utilisant la première ligne
 * comme en-têtes (normalisés en lowercase trimés).
 */
export function csvToRecords(input: string): Record<string, string>[] {
  const rows = parseCsv(input);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = (row[i] ?? "").trim();
    });
    return record;
  });
}
