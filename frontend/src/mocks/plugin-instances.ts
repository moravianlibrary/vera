// The plugin instances as the rest of the mock server reads them (plugins.md §1): the summary
// other records name, and each kind's enabled instances in their order, so that disabling or
// deleting one on Plugins takes it out of Generate, the decide form's suggestion, *Message…*,
// the login page and custody placement. A deleted instance is kept only so its runs name it.

import type { IdentityInstance } from "@/domain/access";
import type { PluginInstance, PluginKind } from "@/domain/plugins";
import { database } from "@/mocks/database";
import type { StoredPluginImplementation, StoredPluginInstance } from "@/mocks/fixtures/plugins";

export function implementationOf(
  instance: Pick<StoredPluginInstance, "implementationId">,
): StoredPluginImplementation | undefined {
  return database.pluginImplementations.find(
    (implementation) => implementation.id === instance.implementationId,
  );
}

export function kindOf(instance: StoredPluginInstance): PluginKind {
  return implementationOf(instance)?.kind ?? "CatalogAdapter";
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
  return database.pluginInstances.filter((instance) => !instance.isDeleted);
}

export function instanceSummaries(): PluginInstance[] {
  return liveInstances().map(summaryOf);
}

function orderOf(instance: StoredPluginInstance): number {
  const settings = instance.settings;
  return settings !== null && "order" in settings ? settings.order : 0;
}

// A kind's enabled instances, in their order, else as they were made.
export function enabledInstancesOf(kind: PluginKind): StoredPluginInstance[] {
  return liveInstances()
    .filter((instance) => instance.isEnabled && kindOf(instance) === kind)
    .toSorted((first, second) => orderOf(first) - orderOf(second));
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
      },
    ];
  });
}

// The enabled custody rules and the custody names each can return.
export function custodyRules(): { instanceId: string; names: readonly string[] }[] {
  return enabledInstancesOf("Custody").map((instance) => ({
    instanceId: instance.id,
    names: instance.settings?.kind === "Custody" ? instance.settings.custodyNames : [],
  }));
}
