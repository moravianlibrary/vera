// A child seed merges keyed records and appends or replaces collection rows by id.
type Json = unknown;
type JsonRecord = Record<string, Json>;
const isRecord = (value: Json): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const idOf = (value: Json): string | undefined =>
  isRecord(value) && typeof value.id === "string" ? value.id : undefined;

function mergeCollection(parent: Json, child: Json): Json {
  if (Array.isArray(parent) && Array.isArray(child)) {
    const merged = [...parent];
    const indexes = new Map<string, number>();
    merged.forEach((item, index) => {
      const id = idOf(item);
      if (id !== undefined && !indexes.has(id)) indexes.set(id, index);
    });
    for (const item of child) {
      const id = idOf(item);
      const index = id === undefined ? undefined : indexes.get(id);
      if (index === undefined) {
        if (id !== undefined) indexes.set(id, merged.length);
        merged.push(item);
      } else merged[index] = item;
    }
    return merged;
  }
  return isRecord(parent) && isRecord(child) ? { ...parent, ...child } : child;
}

export function extendSeed(parent: JsonRecord, child: JsonRecord): JsonRecord {
  const { extends: _parentName, ...base } = parent;
  const { extends: _name, ...own } = child;
  const collections: JsonRecord = { ...(isRecord(base.collections) ? base.collections : {}) };
  for (const [key, value] of Object.entries(isRecord(own.collections) ? own.collections : {})) {
    collections[key] = key in collections ? mergeCollection(collections[key], value) : value;
  }
  return {
    ...base,
    ...own,
    collections,
    fakes: {
      ...(isRecord(base.fakes) ? base.fakes : {}),
      ...(isRecord(own.fakes) ? own.fakes : {}),
    },
  };
}
