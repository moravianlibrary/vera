import type { Engine } from "../engine";
import type { IdentityInstance, ProvidedIdentity } from "./plugin";

export function startUrl(instance: IdentityInstance, flowId: string): string {
  return `/_engine/identity/${encodeURIComponent(instance.id)}?flow=${encodeURIComponent(flowId)}`;
}

export function callback(
  engine: Engine,
  instance: IdentityInstance,
  code: string,
): ProvidedIdentity | null {
  const row = engine.db
    .query<
      {
        external_id: string;
        name: string;
        email: string | null;
        email_verified: number;
        claims: string;
      },
      [string, string]
    >(
      "SELECT external_id, name, email, email_verified, claims FROM fake_identity_accounts WHERE instance_id = ? AND external_id = ?",
    )
    .get(instance.id, code);
  return row === null
    ? null
    : {
        externalId: row.external_id,
        name: row.name,
        email: row.email,
        emailVerified: row.email_verified === 1,
        claims: JSON.parse(row.claims),
        state: {},
      };
}
