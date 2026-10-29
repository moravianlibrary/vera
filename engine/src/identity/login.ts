import type { Engine } from "../engine";
import type { IdentityInstance, ProvidedIdentity } from "./plugin";

export function logIn(
  engine: Engine,
  instance: IdentityInstance,
  identity: ProvidedIdentity,
): { userId: string } | { refusal: "access.suspended" } {
  return engine.db.transaction(() => {
    const now = engine.clock.now().toISOString();
    let linked = engine.db
      .query<{ user_id: string }, [string, string]>(
        "SELECT user_id FROM user_identities WHERE instance_id = ? AND external_id = ?",
      )
      .get(instance.id, identity.externalId);
    if (
      linked === null &&
      instance.settings.matchByEmail &&
      identity.emailVerified &&
      identity.email !== null
    ) {
      linked = engine.db
        .query<{ user_id: string }, [string]>(
          "SELECT id AS user_id FROM users WHERE kind = 'person' AND email IS NOT NULL AND lower(email) = lower(?)",
        )
        .get(identity.email);
    }
    if (linked !== null) {
      const existing = engine.db
        .query<{ suspended_at: string | null }, [string]>(
          "SELECT suspended_at FROM users WHERE id = ?",
        )
        .get(linked.user_id);
      if (existing?.suspended_at !== null && existing !== null)
        return { refusal: "access.suspended" as const };
      const hasIdentity = engine.db
        .query("SELECT 1 FROM user_identities WHERE instance_id = ? AND external_id = ?")
        .get(instance.id, identity.externalId);
      if (hasIdentity === null)
        engine.db
          .query(
            "INSERT INTO user_identities (user_id, instance_id, external_id, last_login_at) VALUES (?, ?, ?, ?)",
          )
          .run(linked.user_id, instance.id, identity.externalId, now);
    }
    if (linked === null) {
      const ids = engine.db
        .query<{ id: string }, []>("SELECT id FROM users WHERE id GLOB 'u[0-9]*'")
        .all();
      const next = ids.reduce((max, row) => Math.max(max, Number(row.id.slice(1)) || 0), 0) + 1;
      const userId = `u${next}`;
      engine.db
        .query(
          "INSERT INTO users (id, name, kind, email, entry, suspended_at) VALUES (?, ?, 'person', ?, NULL, NULL)",
        )
        .run(userId, identity.name, identity.email);
      engine.db
        .query(
          "INSERT INTO user_identities (user_id, instance_id, external_id, last_login_at) VALUES (?, ?, ?, ?)",
        )
        .run(userId, instance.id, identity.externalId, now);
      if (instance.settings.defaultRoleId !== null)
        engine.db
          .query(
            "INSERT INTO user_mapped_roles (user_id, role_id, instance_id, claim) VALUES (?, ?, ?, 'default role')",
          )
          .run(userId, instance.settings.defaultRoleId, instance.id);
      linked = { user_id: userId };
    }
    const userId = linked.user_id;
    engine.db
      .query(
        "DELETE FROM user_mapped_roles WHERE user_id = ? AND instance_id = ? AND claim <> 'default role'",
      )
      .run(userId, instance.id);
    for (const mapping of instance.settings.mappings)
      if (identity.claims.includes(mapping.claim)) {
        engine.db
          .query(
            "INSERT INTO user_mapped_roles (user_id, role_id, instance_id, claim) VALUES (?, ?, ?, ?)",
          )
          .run(userId, mapping.roleId, instance.id, mapping.claim);
      }
    engine.db
      .query(`DELETE FROM user_mapped_roles WHERE user_id = ? AND instance_id IN
      (SELECT id FROM plugin_instances WHERE is_enabled = 0 OR is_deleted = 1)`)
      .run(userId);
    engine.db
      .query(
        "UPDATE user_identities SET last_login_at = ? WHERE user_id = ? AND instance_id = ? AND external_id = ?",
      )
      .run(now, userId, instance.id, identity.externalId);
    return { userId };
  })();
}
