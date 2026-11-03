import type { StoredPluginImplementation, StoredPluginInstance } from "@vera/domain/plugin-store";
import type { PluginKind } from "@vera/domain/plugins";

type InstanceRow = Pick<
  StoredPluginInstance,
  "id" | "implementationId" | "isEnabled" | "isDeleted" | "settings"
>;
type ImplementationRow = Pick<StoredPluginImplementation, "id" | "kind">;

export function implementationOf<I extends ImplementationRow>(
  implementations: readonly I[],
  instance: Pick<StoredPluginInstance, "implementationId">,
): I | undefined {
  return implementations.find(({ id }) => id === instance.implementationId);
}

export function kindOf<I extends ImplementationRow>(
  implementations: readonly I[],
  instance: Pick<StoredPluginInstance, "implementationId">,
): PluginKind {
  return implementationOf(implementations, instance)?.kind ?? "CatalogAdapter";
}

// Deleted ones too, for the runs they made.
export function liveInstances<I extends InstanceRow>(instances: readonly I[]): I[] {
  return instances.filter((instance) => !instance.isDeleted);
}

function orderOf(instance: Pick<StoredPluginInstance, "settings">): number {
  const settings = instance.settings;
  return settings !== null && "order" in settings ? settings.order : 0;
}

// A kind's enabled instances, in their order, else as they were made.
export function enabledInstancesOf<I extends InstanceRow>(
  implementations: readonly ImplementationRow[],
  instances: readonly I[],
  kind: PluginKind,
): I[] {
  return liveInstances(instances)
    .filter((instance) => instance.isEnabled && kindOf(implementations, instance) === kind)
    .toSorted((first, second) => orderOf(first) - orderOf(second));
}
