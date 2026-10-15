// Joins a heading's detail parts into the one secondary line the demos draw under a title, e.g.
// "MZK05-000009901 · Manuscript · RKP-0341". Missing or empty parts are skipped, so a record
// without a shelf mark never leaves a stray separator.

export const detailSeparator = " · ";

export type DetailPart = string | null | undefined;

export function joinDetails(parts: readonly DetailPart[]): string {
  return parts
    .map((part) => part?.trim())
    .filter((part) => part !== undefined && part !== "")
    .join(detailSeparator);
}
