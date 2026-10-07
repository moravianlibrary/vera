// The plugin instances other records name (docs/demos/shared/vera-data.js `pluginTypes`): the
// catalogs, registries, the harvester and the validation that runs and schedules point at, and
// the instances already held elsewhere in the fixtures (list generators, classifiers, message
// channels, identity providers, custody rules), so every instance is named in one place.
// TODO(rrandiak): types, implementations and configuration arrive with Plugins (plan.md step 10).

import type { PluginInstance } from "@/domain/plugins";
import { classifiers } from "@/mocks/fixtures/classifiers";
import { identityInstances } from "@/mocks/fixtures/identity";
import { listGenerators } from "@/mocks/fixtures/list-generators";
import { messageInstances } from "@/mocks/fixtures/message-channels";
import { custodyRules } from "@/mocks/fixtures/proposal-custodies";

const messagePlugins = { mailto: "MailtoMessage", slack: "SlackMessage" } as const;
const identityPlugins: Readonly<Record<string, string>> = {
  pi22: "OidcIdentity",
  pi23: "SamlIdentity",
  pi24: "LocalAccounts",
};

export const pluginInstances: readonly PluginInstance[] = [
  {
    id: "pi1",
    name: "MZK Aleph",
    plugin: "AlephCatalogAdapter",
    kind: "CatalogAdapter",
    isEnabled: true,
  },
  {
    id: "pi2",
    name: "NKP Aleph",
    plugin: "AlephCatalogAdapter",
    kind: "CatalogAdapter",
    isEnabled: true,
  },
  {
    id: "pi3",
    name: "VKOL Aleph",
    plugin: "AlephCatalogAdapter",
    kind: "CatalogAdapter",
    isEnabled: true,
  },
  {
    id: "pi4",
    name: "MZK Kramerius",
    plugin: "KrameriusRegistry",
    kind: "Registry",
    isEnabled: true,
  },
  { id: "pi5", name: "RDCZ production", plugin: "RDCZRegistry", kind: "Registry", isEnabled: true },
  {
    id: "pi8",
    name: "Moravian periodicals",
    plugin: "ISSNHarvester",
    kind: "Harvester",
    isEnabled: true,
  },
  {
    id: "pi9",
    name: "Default ruleset",
    plugin: "CatalogValidity",
    kind: "Validation",
    isEnabled: true,
  },
  ...listGenerators.map(({ id, name, plugin, isEnabled }) => ({
    id,
    name,
    plugin,
    kind: "ListGenerator" as const,
    isEnabled,
  })),
  ...classifiers.map(({ id, name, plugin, isEnabled }) => ({
    id,
    name,
    plugin,
    kind: "Classifier" as const,
    isEnabled,
  })),
  ...messageInstances.map(({ id, name, implementation, isEnabled }) => ({
    id,
    name,
    plugin: messagePlugins[implementation],
    kind: "Message" as const,
    isEnabled,
  })),
  ...identityInstances.map(({ id, name }) => ({
    id,
    name,
    plugin: identityPlugins[id] ?? "OidcIdentity",
    kind: "Identity" as const,
    isEnabled: true,
  })),
  ...custodyRules.map(({ instanceId, name }) => ({
    id: instanceId,
    name,
    plugin: "JqCustody",
    kind: "Custody" as const,
    isEnabled: true,
  })),
];
