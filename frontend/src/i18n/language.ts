// UI-language: the interface speaks Czech or English. Before the person holds a language, it is
// the one picked on the login page, else the one this browser kept, else the browser's, else
// English; the first login keeps it as theirs, and a pick on the login page replaces the one they
// hold. The browser keeps the language last picked or used in it, for the login page.

import type { Language } from "@vera/contract/user-settings";
import { languages } from "@vera/contract/user-settings";
import { i18n } from "@/i18n";

// Each language named in itself, as a picker offers it.
export const languageNames: Readonly<Record<Language, string>> = {
  cs: "Čeština",
  en: "English",
};

const loginPickKey = "vera.login-language";
const keptKey = "vera.language";

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

// The login page's pick lasts across an identity provider's redirect, in this tab only, and the
// browser keeps it.
export function pickLoginLanguage(language: Language): void {
  try {
    window.sessionStorage.setItem(loginPickKey, language);
  } catch {
    // Without storage the pick lasts only for this page.
  }
  keepLanguage(language);
}

// The language last picked or used in this browser.
export function keptLanguage(): Language | null {
  try {
    const kept = window.localStorage.getItem(keptKey);
    return languages.find((language) => language === kept) ?? null;
  } catch {
    return null;
  }
}

export function keepLanguage(language: Language): void {
  try {
    window.localStorage.setItem(keptKey, language);
  } catch {
    // Without storage the login page falls back to the browser's language.
  }
}

// What the login page and the other pages outside the shell speak.
export function languageBeforeLogin(): Language {
  return loginLanguagePick() ?? keptLanguage() ?? browserLanguage();
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

// What the interface speaks: a fresh login pick, the person's own, else this browser's.
export function languageInUse(held: Language | undefined, picked: Language | null): Language {
  return picked ?? held ?? keptLanguage() ?? browserLanguage();
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

// The language the interface speaks now, for names held in each language (UI-names).
export function interfaceLanguage(): Language {
  return i18n.language === "cs" ? "cs" : "en";
}
