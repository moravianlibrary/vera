import { nameIn } from "@vera/domain/names";

export function preferredName(names: { cs?: string; en?: string }): string {
  return names.en ?? names.cs ?? "";
}

export function languageOf(request: Request): "cs" | "en" {
  for (const part of request.headers.get("Accept-Language")?.split(",") ?? []) {
    const language = part.trim().split(";")[0]?.split("-")[0];
    if (language === "cs" || language === "en") return language;
  }
  return "cs";
}

export function localizedName(names: { cs?: string; en?: string }, request: Request): string {
  return nameIn(names, languageOf(request));
}
