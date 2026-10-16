// Matches a path against an endpoint's path, such as "/documents/:id": each `:name` takes one
// whole non-empty segment, decoded. No router library (E3).

export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const expected = pattern.split("/");
  const actual = path.split("/");
  if (expected.length !== actual.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (const [index, part] of expected.entries()) {
    const segment = actual[index] ?? "";
    if (part.startsWith(":")) {
      if (segment === "") {
        return null;
      }

      try {
        params[part.slice(1)] = decodeURIComponent(segment);
      } catch {
        return null;
      }
    } else if (part !== segment) {
      return null;
    }
  }

  return params;
}
