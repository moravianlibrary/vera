// ACT-entry-link: what an outside portal's /ask link asks for, and whether its return address is allowed.

import { entryAskOf } from "@vera/contract/proposals";

export { entryAskOf };

export const entryReasonLimit = 500;

export type { EntryAsk } from "@vera/contract/proposals";

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
