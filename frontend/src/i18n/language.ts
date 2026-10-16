// UI-language: the interface speaks Czech or English. Before the person holds a language, it is
// the one picked on the login page, else the browser's, else English; the first login keeps it
// as theirs, and a pick on the login page replaces the one they hold.

import type { Language } from "@vera/contract/user-settings";
import { languages } from "@vera/contract/user-settings";

// Each language named in itself, as a picker offers it.
export const languageNames: Readonly<Record<Language, string>> = {
  cs: "Čeština",
  en: "English",
};

const loginPickKey = "vera.login-language";

// The first of the browser's languages VERA speaks, in the browser's order of preference.
export function browserLanguageOf(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split("-")[0];
    const language = languages.find((candidate) => candidate === primary);
    if (language !== undefined) {
      return language;
    }
  }

  return "en";
}

export function browserLanguage(): Language {
  return typeof navigator === "undefined"
    ? "en"
    : browserLanguageOf(navigator.languages ?? [navigator.language]);
}

// The login page's pick lasts across an identity provider's redirect, in this tab only.
export function pickLoginLanguage(language: Language): void {
  try {
    window.sessionStorage.setItem(loginPickKey, language);
  } catch {
    // Without storage the pick lasts only for this page.
  }
}

export function loginLanguagePick(): Language | null {
  try {
    const picked = window.sessionStorage.getItem(loginPickKey);
    return languages.find((language) => language === picked) ?? null;
  } catch {
    return null;
  }
}

export function forgetLoginLanguagePick(): void {
  try {
    window.sessionStorage.removeItem(loginPickKey);
  } catch {
    // Nothing was kept.
  }
}

// What the interface speaks: a fresh login pick, the person's own, else the browser's.
export function languageInUse(held: Language | undefined, picked: Language | null): Language {
  return picked ?? held ?? browserLanguage();
}

// What to save as the person's: a login pick replaces theirs, and a first login keeps the one in
// use. Null when nothing changes.
export function languageToSave(
  held: Language | undefined,
  picked: Language | null,
): Language | null {
  const inUse = languageInUse(held, picked);
  return inUse === held ? null : inUse;
}
