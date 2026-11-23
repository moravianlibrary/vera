// The records the store keeps for installed plugin code and its configured instances.

import type { Declarations, InstancePolicy, PluginKind, PluginTrigger } from "./plugins";

export interface StoredPluginVersion {
  readonly version: string;
  readonly contractVersion: string;
  readonly signer: string;
  readonly installedAt: string;
  readonly installedBy: string;
  readonly triggers: PluginTrigger[];
  readonly declares: Declarations;
  readonly configFields: { key: string; isSecret: boolean; isRequired: boolean }[];
}

export type StoredInstanceSettings =
  | {
      kind: "Identity";
      label: string;
      order: number;
      userIdClaim: string;
      defaultRoleId: string | null;
      matchByEmail: boolean;
      mappings: { claim: string; roleId: string }[];
    }
  | { kind: "Custody"; custodyId: string }
  | { kind: "Message" | "Classifier" | "Identifier"; order: number };

export interface StoredPluginImplementation {
  readonly id: string;
  readonly descriptorId: string;
  readonly name: string;
  readonly kind: PluginKind;
  readonly description: string;
  // Newest first.
  readonly versions: readonly StoredPluginVersion[];
}

export interface StoredPluginInstance {
  readonly id: string;
  readonly name: string;
  readonly names: { cs?: string; en?: string };
  readonly implementationId: string;
  readonly version: string;
  readonly isEnabled: boolean;
  // With the secrets, which the server never sends back.
  readonly configuration: Readonly<Record<string, string>>;
  readonly linkedCategoryId: string | null;
  // PLG-bases; absent or empty for every base.
  readonly catalogBases?: readonly string[];
  readonly triggers: readonly PluginTrigger[];
  readonly settings: StoredInstanceSettings | null;
  // Absent while it keeps its version's defaults (PLG-upgrade).
  readonly policy?: InstancePolicy;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly lastRunAt: Date | null;
  // A deleted instance is kept, so the runs it made still name it.
  readonly isDeleted: boolean;
  // DOC-identifiers: shipped with VERA, so never deleted.
  readonly isPredefined?: boolean;
}
