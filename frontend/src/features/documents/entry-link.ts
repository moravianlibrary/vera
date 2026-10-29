// ACT-entry-link: what an outside portal's /ask link asks for, read and limited before anything
// lands; and whether a return address is one the portal allows.

export const entryReasonLimit = 500;

export interface EntryAsk {
  record: string | null;
  identifier: { value: string; type: string } | null;
  unit: string | null;
  reason: string | null;
  sourceId: string | null;
  returnTo: string | null;
}

export function entryAskOf(params: URLSearchParams): EntryAsk {
  const text = (name: string) => params.get(name)?.trim() || null;
  const record = text("record");
  const identifierValue = text("identifier");
  const type = text("type");
  const identifier =
    record === null && identifierValue !== null && type !== null
      ? { value: identifierValue, type }
      : null;
  return {
    record,
    identifier,
    unit: text("unit"),
    reason: text("reason")?.slice(0, entryReasonLimit) ?? null,
    sourceId: text("source"),
    returnTo: text("return"),
  };
}

export function allowedReturn(
  returnTo: string | null,
  allowedOrigins: readonly string[],
): string | null {
  if (returnTo === null) return null;
  try {
    const url = new URL(returnTo);
    return allowedOrigins.includes(url.origin) &&
      (url.protocol === "https:" || url.protocol === "http:")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
