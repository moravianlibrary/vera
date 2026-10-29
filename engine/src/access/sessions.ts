// Sessions (handoff decision 2): a random token in an HttpOnly cookie, the row found by its
// SHA-256. A session slides: each answer pushes its idle limit on, until its absolute limit.
// Times are the engine clock's.

import type { Engine } from "../engine";

export const sessionCookieName = "vera_session";

// Open: these limits are placeholders until the library sets its own.
export const idleMilliseconds = 30 * 60 * 1000;
export const absoluteMilliseconds = 12 * 60 * 60 * 1000;

export interface SignedIn {
  userId: string;
  tokenHash: string;
  token: string;
}

export function hashOf(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

export function openSession(engine: Engine, userId: string, instanceId: string | null): string {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const now = engine.clock.now().toISOString();
  engine.db
    .query(
      `INSERT INTO sessions (token_hash, user_id, instance_id, started_at, seen_at, renewed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(hashOf(token), userId, instanceId, now, now, now);
  return token;
}

export function tokenOf(request: Request): string | null {
  const cookies = request.headers.get("Cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === sessionCookieName) {
      return value.join("=") || null;
    }
  }
  return null;
}

// The session the request carries, seen now; null when there is none, or it has run out (then
// it is deleted) or its person is suspended.
export function sessionOf(engine: Engine, request: Request): SignedIn | null {
  const token = tokenOf(request);
  if (token === null) {
    return null;
  }

  const tokenHash = hashOf(token);
  const row = engine.db
    .query<
      { user_id: string; started_at: string; seen_at: string; suspended_at: string | null },
      [string]
    >(
      `SELECT s.user_id, s.started_at, s.seen_at, u.suspended_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    )
    .get(tokenHash);
  const now = engine.clock.now();
  if (
    row === null ||
    row.suspended_at !== null ||
    now.getTime() - Date.parse(row.seen_at) > idleMilliseconds ||
    now.getTime() - Date.parse(row.started_at) > absoluteMilliseconds
  ) {
    endSession(engine, tokenHash);
    return null;
  }

  engine.db
    .query("UPDATE sessions SET seen_at = ? WHERE token_hash = ?")
    .run(now.toISOString(), tokenHash);
  return { userId: row.user_id, tokenHash, token };
}

export function endSession(engine: Engine, tokenHash: string): void {
  engine.db.query("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

// Reissued on every answer, so the browser's copy lasts as long as the idle limit.
export function sessionCookie(token: string, development: boolean): string {
  const secure = development ? "" : "; Secure";
  return `${sessionCookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${idleMilliseconds / 1000}${secure}`;
}

export function clearedSessionCookie(development: boolean): string {
  const secure = development ? "" : "; Secure";
  return `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}
