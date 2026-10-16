// Who is calling. Until login is built (step 2, L4), only development knows anyone: each dev
// server's proxy names its fixture person in a header, which the engine honours only in
// development (docs/develop/engine.md, Dev servers and signing in).

import type { Database } from "bun:sqlite";
import type { Caller } from "../http/endpoint";

export const devPersonHeader = "X-Vera-Dev-Person";

export function callerOf(db: Database, request: Request, development: boolean): Caller | null {
  const profile = request.headers.get(devPersonHeader);
  if (!development || profile === null) {
    return null;
  }

  const row = db
    .query<{ user_id: string }, [string]>("SELECT user_id FROM dev_people WHERE profile = ?")
    .get(profile);
  return row === null ? null : { userId: row.user_id };
}
