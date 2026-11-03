type MaskKind = "decisions" | "proposals";

const idPatterns: Record<MaskKind, RegExp> = {
  decisions:
    /^(?:B-[\w-]+|D\d+|R\d+|IT-[\da-f-]+|E(?:\d+|-[\da-f-]+)|C-[\da-f-]{36}|HX-[\da-f-]{36}|H-[\da-f-]{36}|[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})$/i,
  proposals:
    /^(?:B-[\w-]+|D(?:\d+|-[\da-f-]{36})|R(?:\d+|-[\da-f-]{36})|IT(?:\d+|-[\da-f-]{36})|E-[\da-f-]{36}|[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})$/i,
};

export function mask(value: unknown, kind: MaskKind, ids = new Map<string, string>()): unknown {
  if (Array.isArray(value)) return value.map((item) => mask(item, kind, ids));
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, mask(item, kind, ids)]),
    );
  if (typeof value !== "string") return value;

  if (idPatterns[kind].test(value)) {
    let token = ids.get(value);
    if (token === undefined) {
      const prefix = value.startsWith("B-")
        ? "B"
        : value.startsWith("IT")
          ? "IT"
          : value.startsWith("E")
            ? "E"
            : kind === "decisions" && value.startsWith("C-")
              ? "C"
              : kind === "decisions" && value.startsWith("HX-")
                ? "HX"
                : kind === "decisions" && value.startsWith("H-")
                  ? "H"
                  : value.startsWith("D")
                    ? "D"
                    : value.startsWith("R")
                      ? "R"
                      : "U";
      const count = [...ids.values()].filter((entry) => entry.startsWith(`<${prefix}`)).length + 1;
      token = `<${prefix}${count}>`;
      ids.set(value, token);
    }
    return token;
  }
  return /^\d{4}-\d\d-\d\dT/.test(value) ? "<time>" : value;
}
