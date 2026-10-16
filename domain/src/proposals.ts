// What a proposal is made of before anything is looked up: an identifier of a known type, the
// volume or issue it names and why it is asked for (view-map.md §1, propose). The format is
// checked here, synchronously, by the rules the server sends for each type (domain/identifiers.ts,
// DOC-identifiers); what the identifier resolves to is the catalog's answer, asked of the server.

import type { IdentifierType, IdentifierTypeRule } from "./identifiers";
import { detectIdentifierType, isIdentifierOf, normalisedOf } from "./identifiers";

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
// line is read as that type; without one each line's type is detected (DOC-lines). A value read
// as a type is normalised as that type's recogniser says.
export function parseProposalLines(
  text: string,
  chosenType: IdentifierType | null,
  rules: readonly IdentifierTypeRule[],
): ProposalLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith(lineComment))
    .map((line) => {
      const [value = "", unit = "", reason = ""] = columnsOf(line);
      return {
        ...readIdentifier(rules, value, chosenType),
        unit: unit || null,
        reason: reason || null,
      };
    });
}

// One value read as the chosen type, or as the type detected; normalised once it has a type.
export function readIdentifier(
  rules: readonly IdentifierTypeRule[],
  value: string,
  chosenType: IdentifierType | null,
): Pick<ProposalLine, "type" | "value"> {
  const type =
    chosenType === null
      ? detectIdentifierType(rules, value)
      : isIdentifierOf(rules, chosenType, value)
        ? chosenType
        : null;
  return { type, value: type === null ? value : normalisedOf(rules, type, value) };
}

function columnsOf(line: string): string[] {
  const separator = line.includes(";") ? ";" : line.includes("\t") ? "\t" : ",";
  return line.split(separator).map((column) => column.trim());
}

// ---------------------------------------------------------------- batch name

// TODO(Tenancy): the library's time zone is MZK's.
const batchNameFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// The name of a batch nobody named: when it was submitted, in the library's time (ENT-batch).
export function defaultBatchNameOf(at: Date): string {
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    batchNameFormatter.formatToParts(at).find((each) => each.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;
}
