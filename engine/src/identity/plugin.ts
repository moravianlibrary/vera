// An Identity plugin does the provider's work; the engine never sees a provider's tokens.
export interface ProvidedIdentity {
  externalId: string;
  name: string;
  email: string | null;
  emailVerified: boolean;
  claims: string[];
  state: Record<string, unknown>;
}

export interface IdentityInstance {
  id: string;
  implementationId: string;
  entry: "form" | "redirect";
  configuration: Record<string, string>;
  settings: {
    label: string;
    order: number;
    userIdClaim: string;
    defaultRoleId: string | null;
    matchByEmail: boolean;
    mappings: { claim: string; roleId: string }[];
  };
}
