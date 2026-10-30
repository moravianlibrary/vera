// Pure rules for what the engine is allowed to record.

export function telemetryUserId(userId: string | null, roleIds: readonly string[]): string | null {
  return userId === null || roleIds.every((role) => role === "reader") ? null : userId;
}

export function routeTemplateOf(endpointPath: string | null): string {
  return endpointPath === null ? "/api/*" : `/api${endpointPath}`;
}

export function jobAttributesOf(kind: string, payload: unknown): Record<string, string> {
  const attributes: Record<string, string> = { "vera.job.kind": kind };
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return attributes;
  for (const [key, value] of Object.entries(payload)) {
    if (key.endsWith("Id") && typeof value === "string") attributes[key] = value;
  }
  return attributes;
}
