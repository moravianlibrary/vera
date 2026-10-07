// What Plugins says (docs/demos/shared/page-plugins.js `KIND_DESC`, `supplies`; vera-data.js
// `KIND_TONE`): each kind's name, colour and the job it does, an instance's triggers, and what an
// implementation declares it supplies, as the chips on its row.
// TODO(rrandiak): labels move to i18n.

import type { PluginVersion } from "@/api/plugins";
import type { Tone } from "@/components/status-badge";
import type { DeclaredNameKind, PluginKind, PluginTrigger } from "@/domain/plugins";

export const pluginKindLabels = {
  CatalogAdapter: "Catalog adapter",
  Registry: "Registry",
  Harvester: "Harvester",
  PropertySource: "Property source",
  Validation: "Validation",
  Restriction: "Restriction",
  Custody: "Custody",
  Input: "Input",
  ListGenerator: "List generator",
  Identity: "Identity",
  Message: "Message",
  DeliveryChannel: "Delivery channel",
  Classifier: "Classifier",
} as const satisfies Record<PluginKind, string>;

export const pluginKindTones = {
  CatalogAdapter: "blue",
  Registry: "purple",
  Harvester: "amber",
  PropertySource: "green",
  Validation: "slate",
  Restriction: "red",
  Custody: "amber",
  Input: "blue",
  ListGenerator: "purple",
  Identity: "blue",
  Message: "green",
  DeliveryChannel: "green",
  Classifier: "purple",
} as const satisfies Record<PluginKind, Tone>;

export const pluginKindJobs = {
  CatalogAdapter: "reads catalog records — page counts, material type, units",
  Registry: "asks whether a copy already exists somewhere",
  Harvester: "finds new documents and proposes them",
  PropertySource: "supplies a value when the catalog has none",
  Validation: "checks a record is complete enough to digitize",
  Restriction: "forbids digitizing — copyright, embargo; only an admin overrules it",
  Custody: "places proposals into proposal custodies",
  Input: "a way of entering items in the propose dialog",
  ListGenerator: "builds a digitization list for an intention",
  Identity: "a way to log in — the login page is built from these",
  Message: "where Message… hands a conversation off to — mail, chat",
  DeliveryChannel: "where a hook can send — email, chat, webhook, file",
  Classifier: "suggests the category a proposal is decided under",
} as const satisfies Record<PluginKind, string>;

export const triggerLabels = {
  OnProposal: "on proposal",
  OnIngest: "on ingest",
  OnRecordChange: "on record change",
  OnSchedule: "on schedule",
  OnDemand: "on demand",
  OnLogin: "on login",
  OnEvent: "on event",
} as const satisfies Record<PluginTrigger, string>;

export const declaredNameKindLabels = {
  rule: "rule",
  property: "property",
  rawState: "registry state",
  identifierType: "identifier",
} as const satisfies Record<DeclaredNameKind, string>;

const generatorClassLabels = { RuleBased: "rule-based", AiBased: "AI-based" } as const;
const entryPointLabels = {
  proposals: "proposals, through review",
  additions: "additions, approved already",
} as const;

export function entryPointText(entryPoint: keyof typeof entryPointLabels): string {
  return entryPointLabels[entryPoint];
}

export function generatorClassText(generatorClass: keyof typeof generatorClassLabels): string {
  return generatorClassLabels[generatorClass];
}

// "page_count tier 50", "4 registry states", "3 rules", "ISSN · ISBN", "agent ISSN harvester".
export function suppliesOf(version: PluginVersion): string[] {
  const { declares } = version;
  return [
    ...declares.properties.map((property) => `${property.key} · tier ${property.tier}`),
    ...(declares.rawStates.length > 0 ? [`${declares.rawStates.length} registry states`] : []),
    ...(declares.rules.length > 0 ? [`${declares.rules.length} rules`] : []),
    ...(declares.identifierTypes.length > 0 ? [declares.identifierTypes.join(" · ")] : []),
    ...(declares.agent === null
      ? []
      : [`agent ${declares.agent.name} → ${declares.agent.entryPoint}`]),
    ...(declares.generatorClass === null ? [] : [generatorClassText(declares.generatorClass)]),
    ...(declares.channelInterface === null
      ? []
      : [`${declares.channelInterface.toLowerCase()} interface`]),
    ...(declares.inputMode === null ? [] : [`${declares.inputMode.toLowerCase()} input`]),
    ...(declares.loginEntry === null
      ? []
      : [declares.loginEntry === "Form" ? "login form" : "login button"]),
  ];
}
