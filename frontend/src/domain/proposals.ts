// What a proposal is made of before anything is looked up: an identifier of a known type, the
// volume or issue it names and why it is asked for (view-map.md §1, propose). The format is
// checked here, synchronously (identifier-types.md); what the identifier resolves to is the
// catalog's answer, asked of the server.
// TODO(Tenancy): the catalog ID and barcode patterns are MZK's (view-rules.md §3 rules 2 and 6);
// the catalog ID also takes the other bases a pasted record link can name.

import { z } from "zod";

export const identifierTypes = ["catalogId", "cnb", "isbn", "issn", "barcode"] as const;
export const identifierTypeSchema = z.enum(identifierTypes);
export type IdentifierType = z.infer<typeof identifierTypeSchema>;

const identifierPatterns = {
  catalogId: /^[A-Z]{3,4}\d{2}-\d{9}$/,
  cnb: /^cnb\d{9}$/i,
  isbn: /^97[89][-\d]{10,14}$/,
  issn: /^\d{4}-\d{3}[\dX]$/,
  barcode: /^MZK-\d{4}-\d{6}$/,
} as const satisfies Record<IdentifierType, RegExp>;

export function isIdentifierOf(type: IdentifierType, value: string): boolean {
  return identifierPatterns[type].test(value);
}

// The first type whose format the value has; null when it has none.
export function detectIdentifierType(value: string): IdentifierType | null {
  return identifierTypes.find((type) => isIdentifierOf(type, value)) ?? null;
}

export interface ProposalLine {
  // Null when the value is not an identifier of the type asked for, or of any type.
  type: IdentifierType | null;
  value: string;
  unit: string | null;
  reason: string | null;
}

const lineComment = "#";

// One item per line: identifier ; volume or issue ; why. A tab or, failing both, a comma also
// separates the columns, so a spreadsheet's CSV export reads as it is. With a type chosen every
// line is read as that type; without one each line's type is detected.
export function parseProposalLines(
  text: string,
  chosenType: IdentifierType | null,
): ProposalLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith(lineComment))
    .map((line) => {
      const [value = "", unit = "", reason = ""] = columnsOf(line);
      const type =
        chosenType === null
          ? detectIdentifierType(value)
          : isIdentifierOf(chosenType, value)
            ? chosenType
            : null;
      return { type, value, unit: unit || null, reason: reason || null };
    });
}

function columnsOf(line: string): string[] {
  const separator = line.includes(";") ? ";" : line.includes("\t") ? "\t" : ",";
  return line.split(separator).map((column) => column.trim());
}
