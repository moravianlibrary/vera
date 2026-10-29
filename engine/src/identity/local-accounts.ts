import type { Engine } from "../engine";
import type { IdentityInstance, ProvidedIdentity } from "./plugin";

export async function formLogin(
  engine: Engine,
  instance: IdentityInstance,
  username: string,
  password: string,
): Promise<ProvidedIdentity | null> {
  const row = engine.db
    .query<{ name: string; email: string | null }, [string, string]>(
      `SELECT u.name, u.email FROM user_identities i JOIN users u ON u.id = i.user_id
     WHERE i.instance_id = ? AND i.external_id = ? AND u.kind = 'person'`,
    )
    .get(instance.id, username);
  if (row === null) return null;
  const saved = engine.db
    .query<{ hash: string }, [string, string]>(
      "SELECT hash FROM local_passwords WHERE instance_id = ? AND username = ?",
    )
    .get(instance.id, username);
  if (saved === null) {
    const hash = await Bun.password.hash(password);
    engine.db
      .query("INSERT INTO local_passwords (instance_id, username, hash) VALUES (?, ?, ?)")
      .run(instance.id, username, hash);
  } else if (!(await Bun.password.verify(password, saved.hash))) {
    return null;
  }
  return {
    externalId: username,
    name: row.name,
    email: row.email,
    emailVerified: false,
    claims: [],
    state: {},
  };
}
