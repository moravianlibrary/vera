// The plugin instances as the rest of the mock server reads them (plugins.md §1): the summary
// other records name, and each kind's enabled instances in their order, so that disabling or
// deleting one on Plugins takes it out of Generate, the decide form's suggestion, *Message…*,
// the login page and custody placement. A deleted instance is kept only so its runs name it.

import {
  enabledInstancesOf as enabledInstancesOfShared,
  implementationOf as implementationOfShared,
  kindOf as kindOfShared,
  liveInstances as liveInstancesShared,
} from "@vera/contract/queries/plugin-instances";
import type { IdentityInstance } from "@vera/domain/access";
import type { PluginInstance, PluginKind } from "@vera/domain/plugins";
import { database } from "@/mocks/database";
import type { StoredPluginImplementation, StoredPluginInstance } from "@/mocks/fixtures/plugins";

export function implementationOf(
  instance: Pick<StoredPluginInstance, "implementationId">,
): StoredPluginImplementation | undefined {
  return implementationOfShared(database.pluginImplementations, instance) as
    | StoredPluginImplementation
    | undefined;
}

export function kindOf(instance: StoredPluginInstance): PluginKind {
  return kindOfShared(database.pluginImplementations, instance);
}

export function summaryOf(instance: StoredPluginInstance): PluginInstance {
  return {
    id: instance.id,
    name: instance.name,
    plugin: implementationOf(instance)?.name ?? "",
    kind: kindOf(instance),
    isEnabled: instance.isEnabled,
  };
}

// Deleted ones too, for the runs they made.
export function findInstanceSummary(instanceId: string | null): PluginInstance | undefined {
  const instance = database.pluginInstances.find((candidate) => candidate.id === instanceId);
  return instance === undefined ? undefined : summaryOf(instance);
}

export function liveInstances(): StoredPluginInstance[] {
  return liveInstancesShared(database.pluginInstances) as StoredPluginInstance[];
}

export function instanceSummaries(): PluginInstance[] {
  return liveInstances().map(summaryOf);
}

// A kind's enabled instances, in their order, else as they were made.
export function enabledInstancesOf(kind: PluginKind): StoredPluginInstance[] {
  return enabledInstancesOfShared(
    database.pluginImplementations,
    database.pluginInstances,
    kind,
  ) as StoredPluginInstance[];
}

// Every identity instance not deleted, enabled or not: a role it mapped stays until the person's
// next login elsewhere, so Users & Groups still names where it came from.
export function identityInstances(): IdentityInstance[] {
  return liveInstances().flatMap((instance) => {
    const settings = instance.settings;
    if (settings?.kind !== "Identity") {
      return [];
    }

    return [
      {
        id: instance.id,
        name: instance.name,
        userIdClaim: settings.userIdClaim,
        defaultRoleId: settings.defaultRoleId,
        mappings: settings.mappings.map((mapping) => ({ ...mapping })),
        isLocal: implementationOf(instance)?.versions[0]?.declares.loginEntry === "Form",
        isEnabled: instance.isEnabled,
      },
    ];
  });
}

// The enabled custody rules and the custody each picked (ACCESS-custody-by-plugins).
export function custodyRules(): { instanceId: string; custodyId: string }[] {
  return enabledInstancesOf("Custody").flatMap((instance) =>
    instance.settings?.kind === "Custody"
      ? [{ instanceId: instance.id, custodyId: instance.settings.custodyId }]
      : [],
  );
}
