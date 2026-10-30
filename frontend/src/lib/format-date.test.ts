import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { formatDay } from "@/lib/format-date";

describe("date formatting", () => {
  afterEach(async () => i18n.changeLanguage("en"));

  it("uses the active Czech locale", async () => {
    await i18n.changeLanguage("cs");
    expect(formatDay("2026-06-21T12:00:00Z")).toMatch(/21\. 6\. 2026/);
  });
});
