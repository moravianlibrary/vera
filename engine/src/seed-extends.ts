// L11: a seed may extend another, as base extends installation. The child's own fields win;
// its collections and fakes merge into the parent's.

type Json = unknown;
type JsonRecord = Record<string, Json>;

const isRecord = (value: Json): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const idOf = (value: Json): string | undefined =>
  isRecord(value) && typeof value.id === "string" ? value.id : undefined;

// A collection both have: in a list, a record with the same id replaces the parent's in place and
// a new one is appended; a keyed record merges key by key; anything else is the child's.
function mergeCollection(parent: Json, child: Json): Json {
  if (Array.isArray(parent) && Array.isArray(child)) {
    const merged = [...parent];
    for (const item of child) {
      const id = idOf(item);
      const index = id === undefined ? -1 : merged.findIndex((existing) => idOf(existing) === id);
      if (index === -1) merged.push(item);
      else merged[index] = item;
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
