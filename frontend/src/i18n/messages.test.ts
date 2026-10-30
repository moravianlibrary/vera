// Every language has the same messages, every permission in the catalog has its line, and the
// language in use follows UI-language.

import { permissionKeys } from "@vera/domain/permissions";
import { afterEach, describe, expect, it } from "vitest";
import { permissionLineOf } from "@/features/access/access-words";
import { resources } from "@/i18n";
import {
  browserLanguageOf,
  forgetLoginLanguagePick,
  languageInUse,
  languageToSave,
  loginLanguagePick,
  pickLoginLanguage,
} from "@/i18n/language";

describe("messages", () => {
  it("has the same keys in Czech as in English, accounting for Czech plurals", () => {
    for (const namespace of Object.keys(resources.en) as (keyof typeof resources.en)[]) {
      const english = Object.keys(resources.en[namespace]);
      const czech = Object.keys(resources.cs[namespace]);
      const englishBases = [...new Set(english.map((key) => key.replace(/_(one|other)$/, "")))];
      expect(
        [...new Set(czech.map((key) => key.replace(/_(one|few|many|other)$/, "")))].sort(),
      ).toEqual(englishBases.sort());
      for (const base of new Set(czech.map((key) => key.replace(/_(one|few|many|other)$/, "")))) {
        if (czech.includes(`${base}_one`)) {
          expect(czech).toEqual(
            expect.arrayContaining([`${base}_one`, `${base}_few`, `${base}_many`, `${base}_other`]),
          );
        }
      }
    }
  });

  it("gives every permission a line", () => {
    for (const permission of permissionKeys) {
      expect(Object.keys(resources.en.access)).toContain(`permission.${permission}.line`);
    }
    expect(permissionLineOf("request.create")).toBe("raise a proposal");
    expect(permissionLineOf("property.size.edit", "Size")).toBe("enter Size by hand");
    expect(permissionLineOf("property.size.edit")).toBe("enter its value by hand");
  });
});

describe("the language in use (UI-language)", () => {
  afterEach(forgetLoginLanguagePick);

  it("takes the first of the browser's languages it speaks, else English", () => {
    expect(browserLanguageOf(["sk-SK", "cs-CZ", "en"])).toBe("cs");
    expect(browserLanguageOf(["en-GB", "cs"])).toBe("en");
    expect(browserLanguageOf(["de-DE", "sk"])).toBe("en");
    expect(browserLanguageOf([])).toBe("en");
  });

  it("keeps the one in use at a first login, and a login pick replaces the person's", () => {
    expect(languageToSave(undefined, null)).toBe("en");
    expect(languageToSave(undefined, "cs")).toBe("cs");
    expect(languageToSave("en", "cs")).toBe("cs");
    expect(languageToSave("cs", "cs")).toBeNull();
    expect(languageToSave("cs", null)).toBeNull();
    expect(languageInUse("cs", null)).toBe("cs");
  });

  it("keeps the login page's pick for this tab", () => {
    expect(loginLanguagePick()).toBeNull();
    pickLoginLanguage("cs");
    expect(loginLanguagePick()).toBe("cs");
    forgetLoginLanguagePick();
    expect(loginLanguagePick()).toBeNull();
  });
});
