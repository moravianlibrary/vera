import { i18n } from "@/i18n";

// UI-language: dates and numbers follow the interface language (navigation.md §UI-language).
export function localeOf(): string {
  return i18n.language === "cs" ? "cs-CZ" : "en-GB";
}
