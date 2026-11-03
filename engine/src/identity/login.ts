import { nextUserId } from "../access/users";
import type { Engine } from "../engine";
import { newCorrelationId, recordEvent } from "../events";
import type { IdentityInstance, ProvidedIdentity } from "./plugin";

export function createLinkedPerson(
  engine: Engine,
  instance: IdentityInstance,
  identity: { externalId: string; name: string; email: string | null },
  now: string,
  recordFirstLogin = true,
): string {
  const userId = nextUserId(engine);
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
  if (recordFirstLogin)
    recordEvent(engine, {
      code: "user.created",
      subjectKind: "user",
      subjectId: userId,
      actor: { kind: "system" },
      correlationId: newCorrelationId(),
      data: {
        changes: [
          { field: "how", from: null, to: "first_login" },
          { field: "instanceId", from: null, to: instance.id },
        ],
      },
    });
  return userId;
}

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
      linked = { user_id: createLinkedPerson(engine, instance, identity, now) };
    }
    const userId = linked.user_id;
    const beforeMappings = engine.db
      .query<{ role_id: string; claim: string }, [string, string]>(
        "SELECT role_id,claim FROM user_mapped_roles WHERE user_id=? AND instance_id=? AND claim<>'default role' ORDER BY rowid",
      )
      .all(userId, instance.id);
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
    const afterMappings = engine.db
      .query<{ role_id: string; claim: string }, [string, string]>(
        "SELECT role_id,claim FROM user_mapped_roles WHERE user_id=? AND instance_id=? AND claim<>'default role' ORDER BY rowid",
      )
      .all(userId, instance.id);
    if (JSON.stringify(beforeMappings) !== JSON.stringify(afterMappings))
      recordEvent(engine, {
        code: "user.roles_changed",
        subjectKind: "user",
        subjectId: userId,
        actor: { kind: "system" },
        correlationId: newCorrelationId(),
        data: {
          changes: [
            {
              field: "mappedRoleIds",
              from: beforeMappings.map((role) => role.role_id),
              to: afterMappings.map((role) => role.role_id),
            },
          ],
        },
      });
    engine.db
      .query(
        "UPDATE user_identities SET last_login_at = ? WHERE user_id = ? AND instance_id = ? AND external_id = ?",
      )
      .run(now, userId, instance.id, identity.externalId);
    return { userId };
  })();
}
