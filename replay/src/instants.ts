const isoUtcInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export function normalizeInstants(value: unknown): unknown {
  if (typeof value === "string" && isoUtcInstant.test(value)) {
    const time = Date.parse(value);
    return Number.isNaN(time) ? value : new Date(value).toISOString();
  }
  if (Array.isArray(value)) return value.map(normalizeInstants);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizeInstants(nested)]),
    );
  }
  return value;
}
