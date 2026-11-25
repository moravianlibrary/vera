// A child seed merges keyed records and appends or replaces collection rows by id; shipped plugins
// merge by package and their instances by id. backend/.../installation/SeedExtension.java is the same.
type Json = unknown;
type JsonRecord = Record<string, Json>;
const isRecord = (value: Json): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const idOf = (value: Json): string | undefined =>
  isRecord(value) && typeof value.id === "string" ? value.id : undefined;

const packageOf = (value: Json): string | undefined =>
  isRecord(value) && typeof value.package === "string" ? value.package : undefined;

function mergeRows(
  parent: Json[],
  child: Json[],
  keyOf: (value: Json) => string | undefined,
  replace: (old: Json, row: Json) => Json,
): Json[] {
  const merged = [...parent];
  const indexes = new Map<string, number>();
  merged.forEach((item, index) => {
    const key = keyOf(item);
    if (key !== undefined && !indexes.has(key)) indexes.set(key, index);
  });
  for (const item of child) {
    const key = keyOf(item);
    const index = key === undefined ? undefined : indexes.get(key);
    if (index === undefined) {
      if (key !== undefined) indexes.set(key, merged.length);
      merged.push(item);
    } else merged[index] = replace(merged[index], item);
  }
  return merged;
}

function mergeCollection(parent: Json, child: Json): Json {
  if (Array.isArray(parent) && Array.isArray(child)) return mergeRows(parent, child, idOf, (_, row) => row);
  return isRecord(parent) && isRecord(child) ? { ...parent, ...child } : child;
}

function mergeShippedPlugins(parent: Json[], child: Json[]): Json[] {
  return mergeRows(parent, child, packageOf, (old, group) => {
    const oldGroup = old as JsonRecord;
    const instances = (group as JsonRecord).instances;
    return {
      ...oldGroup,
      instances: mergeRows(
        Array.isArray(oldGroup.instances) ? oldGroup.instances : [],
        Array.isArray(instances) ? instances : [],
        idOf,
        (_, row) => row,
      ),
    };
  });
}

export function extendSeed(parent: JsonRecord, child: JsonRecord): JsonRecord {
  const { extends: _parentName, ...base } = parent;
  const { extends: _name, ...own } = child;
  const collections: JsonRecord = { ...(isRecord(base.collections) ? base.collections : {}) };
  for (const [key, value] of Object.entries(isRecord(own.collections) ? own.collections : {})) {
    collections[key] = key in collections ? mergeCollection(collections[key], value) : value;
  }
  const shipped =
    Array.isArray(base.shippedPlugins) && Array.isArray(own.shippedPlugins)
      ? { shippedPlugins: mergeShippedPlugins(base.shippedPlugins, own.shippedPlugins) }
      : {};
  return {
    ...base,
    ...own,
    ...shipped,
    collections,
    fakes: {
      ...(isRecord(base.fakes) ? base.fakes : {}),
      ...(isRecord(own.fakes) ? own.fakes : {}),
    },
  };
}
