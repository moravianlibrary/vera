// The tier from the window's width, and per-tier values falling back towards notebook.

import { describe, expect, it } from "vitest";
import { tierOf, valueForTier } from "@/hooks/use-tier";

describe("tierOf", () => {
  it("names the widest tier the window reaches", () => {
    const none = { isSmall: false, isNotebook: false, isLarge: false };

    expect(tierOf(none)).toBe("phone");
    expect(tierOf({ ...none, isSmall: true })).toBe("small");
    expect(tierOf({ isSmall: true, isNotebook: true, isLarge: false })).toBe("notebook");
    expect(tierOf({ isSmall: true, isNotebook: true, isLarge: true })).toBe("large");
  });
});

describe("valueForTier", () => {
  it("takes notebook's value where a tier has none", () => {
    const columns = { notebook: 2 };

    expect(valueForTier(columns, "large")).toBe(2);
    expect(valueForTier(columns, "phone")).toBe(2);
  });

  it("lets the phone fall back to small before notebook", () => {
    const columns = { notebook: 3, small: 1 };

    expect(valueForTier(columns, "phone")).toBe(1); // nearest neighbour towards notebook
  });
});
