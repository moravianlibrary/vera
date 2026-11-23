// UI-appearance: the browser keeps the appearance last picked or used in it, and logging in moves
// it to the person as UI-language moves the language.

import { afterEach, describe, expect, it } from "vitest";
import {
  appearanceInUse,
  appearanceToSave,
  forgetLoginAppearancePick,
  keptAppearance,
  loginAppearancePick,
  pickLoginAppearance,
} from "@/hooks/use-appearance";

describe("the appearance in use (UI-appearance)", () => {
  afterEach(() => {
    forgetLoginAppearancePick();
    window.localStorage.clear();
  });

  it("follows the system's until someone picks", () => {
    expect(appearanceInUse(undefined, null)).toBe("system");
    expect(appearanceToSave(undefined, null)).toBe("system");
  });

  it("keeps the login page's pick for this tab, and in this browser after it", () => {
    pickLoginAppearance("dark");
    expect(loginAppearancePick()).toBe("dark");
    forgetLoginAppearancePick();
    expect(loginAppearancePick()).toBeNull();
    expect(keptAppearance()).toBe("dark");
  });

  it("keeps the one in use at a first login, and a login pick replaces the person's", () => {
    pickLoginAppearance("dark");
    expect(appearanceToSave(undefined, loginAppearancePick())).toBe("dark");
    expect(appearanceToSave("light", loginAppearancePick())).toBe("dark");
    expect(appearanceToSave("dark", loginAppearancePick())).toBeNull();
  });

  it("never puts what the browser kept over the person's own", () => {
    pickLoginAppearance("dark");
    forgetLoginAppearancePick();
    expect(appearanceInUse("light", null)).toBe("light");
    expect(appearanceToSave("light", null)).toBeNull();
    expect(appearanceToSave(undefined, null)).toBe("dark");
  });
});
