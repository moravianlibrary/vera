// Plugins (plugins.md §1–§2, §4): a kind is the job, an implementation the code that does it, with
// what it declares, and an instance a configured copy that runs. Other records name an instance by
// its summary; Plugins reads the whole of each. What a new version declares beside the one an
// instance runs is worked out here, for the upload and for moving an instance (§2.5–§2.6).

import { z } from "zod";

// PLG-kinds: in the order a document meets them, which Plugins lists them in.
export const pluginKinds = [
  "Identity",
  "Input",
  "Harvester",
  "CatalogAdapter",
  "PropertySource",
  "Registry",
  "Validation",
  "Restriction",
  "Custody",
  "Classifier",
  "ListGenerator",
  "Link",
  "PublicationDetector",
  "Message",
  "DeliveryChannel",
] as const;
export const pluginKindSchema = z.enum(pluginKinds);
export type PluginKind = z.infer<typeof pluginKindSchema>;

// An instance as other records name it: what a run, a schedule or a filter points at.
export const pluginInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  // The implementation it runs: "AlephCatalogAdapter".
  plugin: z.string(),
  kind: pluginKindSchema,
  isEnabled: z.boolean(),
});
export type PluginInstance = z.infer<typeof pluginInstanceSchema>;

// plugins.md §2.4.
export const pluginTriggers = [
  "OnProposal",
  "OnIngest",
  "OnRecordChange",
  "OnSchedule",
  "OnDemand",
  "OnLogin",
  "OnEvent",
] as const;
export const pluginTriggerSchema = z.enum(pluginTriggers);
export type PluginTrigger = z.infer<typeof pluginTriggerSchema>;

export const generatorClasses = ["RuleBased", "AiBased"] as const;
export const generatorClassSchema = z.enum(generatorClasses);
export type GeneratorClass = z.infer<typeof generatorClassSchema>;

// A delivery channel provides one interface (STATUS "Hooks"); an input one way into Propose (§4.8).
export const channelInterfaces = ["Email", "Chat", "Webhook", "File"] as const;
export const inputModes = ["Text", "Camera", "Photo"] as const;
// An identity is a button that redirects, or VERA's own form (§4.10).
export const loginEntries = ["Redirect", "Form"] as const;
// What a harvester's agent proposes into: review, or already approved (view-map.md §6).
export const entryPoints = ["proposals", "additions"] as const;

// What an implementation declares, each a closed list it keeps stable (plugins.md §2.1, §2.5).
// The property tiers, the registry mapping and the agent are the demo's, on the implementation.
// TODO(rrandiak): plugins.md §2.7–§2.8 and §4.2 (Proposed) set tiers, the mapping and the agent
// on the instance instead; they move there if that is confirmed.
export const declarationsSchema = z.object({
  properties: z.array(z.object({ key: z.string(), tier: z.number().int() })),
  identifierTypes: z.array(z.string()),
  // A raw state with no state is Unmapped, shown verbatim.
  rawStates: z.array(
    z.object({ raw: z.string(), state: z.string().nullable(), isExistingCopy: z.boolean() }),
  ),
  rules: z.array(z.object({ code: z.string(), label: z.string() })),
  agent: z.object({ name: z.string(), entryPoint: z.enum(entryPoints) }).nullable(),
  generatorClass: generatorClassSchema.nullable(),
  channelInterface: z.enum(channelInterfaces).nullable(),
  inputMode: z.enum(inputModes).nullable(),
  loginEntry: z.enum(loginEntries).nullable(),
});
export type Declarations = z.infer<typeof declarationsSchema>;

// One field of an instance's configuration (plugins.md §2.2): a secret is stored apart and never
// sent back.
export const configFieldSchema = z.object({
  key: z.string(),
  isSecret: z.boolean(),
  isRequired: z.boolean(),
});
export type ConfigField = z.infer<typeof configFieldSchema>;

// ---------------------------------------------------------------- versions

// "2.4.1" against "2.10.0", by number.
export function compareVersions(first: string, second: string): number {
  const partsOf = (version: string) => version.split(".").map((part) => Number.parseInt(part, 10));
  const [firstParts, secondParts] = [partsOf(first), partsOf(second)];
  for (let index = 0; index < Math.max(firstParts.length, secondParts.length); index += 1) {
    const difference = (firstParts[index] ?? 0) - (secondParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

// VERA runs an implementation built against the same major contract version (plugins.md §2.6).
export const runningContractVersion = "1.0";

export function isRunnableContract(contractVersion: string): boolean {
  return contractVersion.split(".")[0] === runningContractVersion.split(".")[0];
}

export const declaredNameKinds = ["rule", "property", "rawState", "identifierType"] as const;
export type DeclaredNameKind = (typeof declaredNameKinds)[number];

export interface DeclaredName {
  readonly kind: DeclaredNameKind;
  readonly name: string;
  // A rule's label; none for the rest.
  readonly label: string | null;
}

export function declaredNamesOf(declarations: Declarations): DeclaredName[] {
  return [
    ...declarations.rules.map((rule) => ({
      kind: "rule" as const,
      name: rule.code,
      label: rule.label,
    })),
    ...declarations.properties.map((property) => ({
      kind: "property" as const,
      name: property.key,
      label: null,
    })),
    ...declarations.rawStates.map((state) => ({
      kind: "rawState" as const,
      name: state.raw,
      label: null,
    })),
    ...declarations.identifierTypes.map((type) => ({
      kind: "identifierType" as const,
      name: type,
      label: null,
    })),
  ];
}

export interface DeclarationDifference {
  readonly added: DeclaredName[];
  // A retired rule code stops being reported, so approvals made against it cover nothing.
  readonly retired: DeclaredName[];
  readonly configAdded: string[];
  readonly configDropped: string[];
}

interface Declared {
  readonly declares: Declarations;
  readonly configFields: readonly ConfigField[];
}

export function declarationDifferenceOf(from: Declared, to: Declared): DeclarationDifference {
  const keyOf = (name: DeclaredName) => `${name.kind}:${name.name}`;
  const [fromNames, toNames] = [declaredNamesOf(from.declares), declaredNamesOf(to.declares)];
  const fromKeys = new Set(fromNames.map(keyOf));
  const toKeys = new Set(toNames.map(keyOf));
  const fromFields = new Set(from.configFields.map((field) => field.key));
  const toFields = new Set(to.configFields.map((field) => field.key));
  return {
    added: toNames.filter((name) => !fromKeys.has(keyOf(name))),
    retired: fromNames.filter((name) => !toKeys.has(keyOf(name))),
    configAdded: [...toFields].filter((key) => !fromFields.has(key)),
    configDropped: [...fromFields].filter((key) => !toFields.has(key)),
  };
}

export function isUnchanged(difference: DeclarationDifference): boolean {
  return (
    difference.added.length +
      difference.retired.length +
      difference.configAdded.length +
      difference.configDropped.length ===
    0
  );
}
