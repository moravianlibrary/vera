// What Plugins says (docs/demos/shared/page-plugins.js `KIND_DESC`, `supplies`, `LOSS`;
// vera-data.js `KIND_TONE`): each kind's name, colour and the job it does, an instance's
// triggers, what an implementation declares it supplies, as the chips on its row, and what
// stops when an instance is switched off.

import type { PluginImpact, PluginVersion } from "@vera/contract/plugins";
import type {
  Declarations,
  DeclaredName,
  DeclaredNameKind,
  PluginKind,
  PluginTrigger,
} from "@vera/domain/plugins";
import type { Tone } from "@/components/status-badge";
import { i18n } from "@/i18n";

export const pluginKindLabels = {
  Identity: "plugins:pluginWords.kind.Identity",
  Input: "plugins:pluginWords.kind.Input",
  Identifier: "plugins:pluginWords.kind.Identifier",
  Harvester: "plugins:pluginWords.kind.Harvester",
  CatalogAdapter: "plugins:pluginWords.kind.CatalogAdapter",
  PropertySource: "plugins:pluginWords.kind.PropertySource",
  Registry: "plugins:pluginWords.kind.Registry",
  Validation: "plugins:pluginWords.kind.Validation",
  Restriction: "plugins:pluginWords.kind.Restriction",
  Custody: "plugins:pluginWords.kind.Custody",
  Classifier: "plugins:pluginWords.kind.Classifier",
  ListGenerator: "plugins:pluginWords.kind.ListGenerator",
  Link: "plugins:pluginWords.kind.Link",
  PublicationDetector: "plugins:pluginWords.kind.PublicationDetector",
  Message: "plugins:pluginWords.kind.Message",
  DeliveryChannel: "plugins:pluginWords.kind.DeliveryChannel",
} as const satisfies Record<PluginKind, string>;

export const pluginKindTones = {
  Identity: "blue",
  Input: "blue",
  Identifier: "slate",
  Harvester: "amber",
  CatalogAdapter: "blue",
  PropertySource: "green",
  Registry: "purple",
  Validation: "slate",
  Restriction: "red",
  Custody: "amber",
  Classifier: "purple",
  ListGenerator: "purple",
  Link: "blue",
  PublicationDetector: "green",
  Message: "green",
  DeliveryChannel: "green",
} as const satisfies Record<PluginKind, Tone>;

export const pluginKindJobs = {
  Identity: "plugins:pluginWords.job.Identity",
  Input: "plugins:pluginWords.job.Input",
  Identifier: "plugins:pluginWords.job.Identifier",
  Harvester: "plugins:pluginWords.job.Harvester",
  CatalogAdapter: "plugins:pluginWords.job.CatalogAdapter",
  PropertySource: "plugins:pluginWords.job.PropertySource",
  Registry: "plugins:pluginWords.job.Registry",
  Validation: "plugins:pluginWords.job.Validation",
  Restriction: "plugins:pluginWords.job.Restriction",
  Custody: "plugins:pluginWords.job.Custody",
  Classifier: "plugins:pluginWords.job.Classifier",
  ListGenerator: "plugins:pluginWords.job.ListGenerator",
  Link: "plugins:pluginWords.job.Link",
  PublicationDetector: "plugins:pluginWords.job.PublicationDetector",
  Message: "plugins:pluginWords.job.Message",
  DeliveryChannel: "plugins:pluginWords.job.DeliveryChannel",
} as const satisfies Record<PluginKind, string>;

export const triggerLabels = {
  OnProposal: "plugins:pluginWords.trigger.OnProposal",
  OnIngest: "plugins:pluginWords.trigger.OnIngest",
  OnRecordChange: "plugins:pluginWords.trigger.OnRecordChange",
  OnSchedule: "plugins:pluginWords.trigger.OnSchedule",
  OnDemand: "plugins:pluginWords.trigger.OnDemand",
  OnLogin: "plugins:pluginWords.trigger.OnLogin",
  OnEvent: "plugins:pluginWords.trigger.OnEvent",
} as const satisfies Record<PluginTrigger, string>;

export const declaredNameKindLabels = {
  rule: "plugins:pluginWords.declaredNameKind.rule",
  property: "plugins:pluginWords.declaredNameKind.property",
  rawState: "plugins:pluginWords.declaredNameKind.rawState",
  identifierType: "plugins:pluginWords.declaredNameKind.identifierType",
} as const satisfies Record<DeclaredNameKind, string>;

const generatorClassLabels = {
  RuleBased: "plugins:pluginWords.generatorClass.RuleBased",
  AiBased: "plugins:pluginWords.generatorClass.AiBased",
} as const;
const entryPointLabels = {
  proposals: "plugins:pluginWords.entryPoint.proposals",
  additions: "plugins:pluginWords.entryPoint.additions",
} as const;
const operationLabels = {
  readBarcode: "plugins:pluginWords.operation.readBarcode",
  readPhoto: "plugins:pluginWords.operation.readPhoto",
  entry: "plugins:pluginWords.operation.entry",
  readLink: "plugins:pluginWords.operation.readLink",
  search: "plugins:pluginWords.operation.search",
  changes: "plugins:pluginWords.operation.changes",
  sync: "plugins:pluginWords.operation.sync",
} as const;

export function operationText(operation: keyof typeof operationLabels): string {
  return i18n.t(operationLabels[operation]);
}

export function entryPointText(entryPoint: keyof typeof entryPointLabels): string {
  return i18n.t(entryPointLabels[entryPoint]);
}

export function generatorClassText(generatorClass: keyof typeof generatorClassLabels): string {
  return i18n.t(generatorClassLabels[generatorClass]);
}

// "page_count tier 50", "4 registry states", "3 rules", "ISSN · ISBN", "agent Periodical gaps".
export function suppliesOf(version: PluginVersion): string[] {
  const { declares } = version;
  return [
    ...declares.properties.map((property) =>
      i18n.t("plugins:pluginWords.supplyProperty", { key: property.key, tier: property.tier }),
    ),
    ...(declares.rawStates.length > 0
      ? [i18n.t("plugins:pluginWords.supplyRegistryStates", { count: declares.rawStates.length })]
      : []),
    ...(declares.rules.length > 0
      ? [i18n.t("plugins:pluginWords.supplyRules", { count: declares.rules.length })]
      : []),
    ...(declares.identifierTypes.length > 0 ? [declares.identifierTypes.join(" · ")] : []),
    ...(declares.agent === null
      ? []
      : [
          i18n.t("plugins:pluginWords.supplyAgent", {
            name: declares.agent.name,
            entryPoint: declares.agent.entryPoint,
          }),
        ]),
    ...(declares.generatorClass === null ? [] : [generatorClassText(declares.generatorClass)]),
    ...(declares.channelInterface === null
      ? []
      : [
          i18n.t("plugins:pluginWords.supplyInterface", {
            name: declares.channelInterface.toLowerCase(),
          }),
        ]),
    ...(declares.personReach === undefined || declares.personReach === null
      ? []
      : [
          i18n.t("plugins:pluginWords.supplyPersonReach", {
            reach: personReachText(declares.personReach),
          }),
        ]),
    ...(declares.operations?.includes("readBarcode")
      ? [i18n.t("plugins:pluginWords.supplyInput", { name: "camera" })]
      : []),
    ...(declares.operations?.includes("readPhoto")
      ? [i18n.t("plugins:pluginWords.supplyInput", { name: "photo" })]
      : []),
    ...(declares.loginEntry === null
      ? []
      : [
          i18n.t(
            declares.loginEntry === "Form"
              ? "plugins:pluginWords.loginForm"
              : "plugins:pluginWords.loginButton",
          ),
        ]),
  ];
}

// ---------------------------------------------------------------- what switching one off stops

// What stops while an instance is off, by its kind, from the server's count (STATUS "Plugins":
// "the last generator — the Generate button disappears").
export function lossText(impact: PluginImpact, instanceName: string): string {
  const hasOthers = impact.otherEnabledCount > 0;
  switch (impact.kind) {
    case "CatalogAdapter":
      return i18n.t("plugins:pluginWords.loss.catalogAdapter", { name: instanceName });
    case "Registry":
      return i18n.t("plugins:pluginWords.loss.registry", { name: instanceName });
    case "PropertySource":
      return i18n.t("plugins:pluginWords.loss.propertySource");
    case "Harvester":
      return i18n.t("plugins:pluginWords.loss.harvester");
    case "Validation":
      return i18n.t("plugins:pluginWords.loss.validation");
    case "Restriction":
      return i18n.t("plugins:pluginWords.loss.restriction");
    case "Custody":
      return i18n.t("plugins:pluginWords.loss.custody", {
        count: impact.openProposalCount,
      });
    case "Identifier":
      return i18n.t("plugins:pluginWords.loss.identifier");
    case "Input":
      return hasOthers
        ? i18n.t("plugins:pluginWords.loss.inputOthers")
        : i18n.t("plugins:pluginWords.loss.inputLast");
    case "ListGenerator":
      return hasOthers
        ? i18n.t("plugins:pluginWords.loss.generatorOthers")
        : i18n.t("plugins:pluginWords.loss.generatorLast");
    case "Link":
      return hasOthers
        ? i18n.t("plugins:pluginWords.loss.linkOthers")
        : i18n.t("plugins:pluginWords.loss.linkLast");
    case "PublicationDetector":
      return i18n.t("plugins:pluginWords.loss.publicationDetector");
    case "Identity":
      return i18n.t("plugins:pluginWords.loss.identity", {
        sign: i18n.t("plugins:pluginWords.loss.personSigns", { count: impact.userCount }),
      });
    case "Message":
      return hasOthers
        ? i18n.t("plugins:pluginWords.loss.messageOthers")
        : i18n.t("plugins:pluginWords.loss.messageLast");
    case "DeliveryChannel":
      return impact.hookCount === 0
        ? i18n.t("plugins:pluginWords.loss.channelNoHooks")
        : i18n.t("plugins:pluginWords.loss.channelHooks", {
            count: impact.hookCount,
            hooks:
              impact.hooks.length === 0
                ? ""
                : ` — ${impact.hooks.map(({ name }) => name).join(", ")}`,
          });
    case "Classifier":
      return hasOthers
        ? i18n.t("plugins:pluginWords.loss.classifierOthers")
        : i18n.t("plugins:pluginWords.loss.classifierLast");
  }
}

// "rule R11 extent matches what was delivered", "registry state Revision".
export function declaredNameText(name: DeclaredName): string {
  return `${i18n.t(declaredNameKindLabels[name.kind])} ${name.name}${name.label === null ? "" : ` ${name.label}`}`;
}

// "by the account's email", "by the slack_id claim".
export function personReachText(reach: NonNullable<Declarations["personReach"]>): string {
  return reach.by === "email"
    ? i18n.t("plugins:pluginWords.personReach.email")
    : i18n.t("plugins:pluginWords.personReach.claim", { claim: reach.claim });
}
