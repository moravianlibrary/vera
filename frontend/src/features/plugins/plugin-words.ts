// What Plugins says (docs/demos/shared/page-plugins.js `KIND_DESC`, `supplies`, `LOSS`;
// vera-data.js `KIND_TONE`): each kind's name, colour and the job it does, an instance's
// triggers, what an implementation declares it supplies, as the chips on its row, and what
// stops when an instance is switched off.
// TODO(rrandiak): labels move to i18n.

import type { PluginImpact, PluginVersion } from "@/api/plugins";
import type { Tone } from "@/components/status-badge";
import type { DeclaredName, DeclaredNameKind, PluginKind, PluginTrigger } from "@/domain/plugins";
import { plural } from "@/lib/plural";

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

// ---------------------------------------------------------------- what switching one off stops

// What stops while an instance is off, by its kind, from the server's count (STATUS "Plugins":
// "the last generator — the Generate button disappears").
export function lossText(impact: PluginImpact, instanceName: string): string {
  const hasOthers = impact.otherEnabledCount > 0;
  switch (impact.kind) {
    case "CatalogAdapter":
      return `${instanceName} can no longer be searched when proposing, and its records stop resyncing.`;
    case "Registry":
      return `existing-copy checks against ${instanceName} stop, and the registry states it reported go stale.`;
    case "PropertySource":
      return "values it already supplied stay; new documents get none from it.";
    case "Harvester":
      return "it stops proposing new documents.";
    case "Validation":
      return "its rules stop running on ingest; defects it already found stay.";
    case "Restriction":
      return "it stops forbidding anything new. What it already forbade stays forbidden until a re-check clears it or an admin overrules it.";
    case "Custody":
      return `the ${plural(impact.openProposalCount, "open proposal")} it places now are placed again without its rule; what nothing else places lands in the fallback.`;
    case "Input":
      return hasOthers
        ? "another instance still offers this way of entering items."
        : "this way of entering items disappears from the propose dialog.";
    case "ListGenerator":
      return hasOthers
        ? "it disappears from Generate; other generators stay."
        : "it is the last generator: the Generate button disappears from Digitization Lists.";
    case "Identity":
      return `it leaves the login page. ${plural(impact.userCount, "person signs", "people sign")} in through it; they keep their records but cannot log in this way, and roles it mapped stay until their next login elsewhere.`;
    case "Message":
      return hasOthers
        ? "Message… stops offering it; other ways stay."
        : "it is the last one: Message… disappears everywhere.";
    case "DeliveryChannel":
      return `${plural(impact.hookCount, "active hook")} sending through it ${impact.hookCount === 1 ? "stops" : "stop"}; waiting deliveries resume when the channel is enabled again.`;
    case "Classifier":
      return hasOthers
        ? "the decide form stops showing its suggestions; the others still suggest."
        : "it is the last classifier: the decider picks a category with no suggestion.";
  }
}

// "rule R11 extent matches what was delivered", "registry state Revision".
export function declaredNameText(name: DeclaredName): string {
  return `${declaredNameKindLabels[name.kind]} ${name.name}${name.label === null ? "" : ` ${name.label}`}`;
}
