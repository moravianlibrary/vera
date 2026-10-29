// Pure rules for what the browser client is allowed to record.

export function telemetryUserId(
  session: { user: { id: string }; roleIds: readonly string[] } | undefined,
): string | null {
  return session === undefined || session.roleIds.every((role) => role === "reader")
    ? null
    : session.user.id;
}

export function routeTemplateOf(patterns: readonly (string | undefined)[]): string {
  const parts = patterns
    .filter((pattern) => pattern !== undefined && pattern !== "/")
    .map((pattern) => pattern?.replace(/^\/+/, ""));
  return parts.length === 0 ? "/" : `/${parts.join("/")}`;
}

export function withoutQuery(url: string): string {
  const parsed = new URL(url, window.location.origin);
  return `${parsed.origin}${parsed.pathname}`;
}

export function redactedUrl(url: string): string {
  const parsed = new URL(withoutQuery(url));
  const segments = parsed.pathname.split("/");
  const sensitiveParents = new Set(["notification-preferences", "verify-email", "reset-password"]);
  for (let index = 1; index < segments.length; index += 1) {
    const segment = segments[index];
    if (
      segment !== undefined &&
      segment !== "" &&
      ((!sensitiveParents.has(segment) && /^[A-Za-z0-9_-]{20,}$/.test(segment)) ||
        (segments[index - 1] !== undefined && sensitiveParents.has(segments[index - 1])))
    ) {
      segments[index] = ":token";
    }
  }
  return `${parsed.origin}${segments.join("/")}`;
}
