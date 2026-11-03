import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import {
  formatCalendarDay,
  formatDay,
  formatLongCalendarDay,
  formatLongDay,
  formatLongDayAndTime,
  formatShortCalendarDay,
} from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";

process.env.TZ = "Europe/Prague";

describe("date formatting", () => {
  afterEach(async () => {
    document.documentElement.dataset.dateFormat = "local";
    await i18n.changeLanguage("en");
  });

  it("uses compact dates in English", () => {
    expect(formatDay("2026-06-21T12:00:00Z")).toBe("21 Jun 2026");
    expect(formatCalendarDay("2026-06-21")).toBe("21 Jun 2026");
    expect(formatShortCalendarDay("2026-06-21")).toBe("21 Jun");
  });

  it("uses long dates and time in English", () => {
    expect(formatLongDay("2026-06-21T12:00:00Z")).toBe("21 June 2026");
    expect(formatLongCalendarDay("2026-06-21")).toBe("21 June 2026");
    expect(formatLongDayAndTime("2026-06-21T12:01:00Z")).toBe("21 June 2026 at 14:01");
  });

  it("uses compact dates in Czech", async () => {
    await i18n.changeLanguage("cs");
    expect(formatDay("2026-06-21T12:00:00Z")).toBe("21. 6. 2026");
    expect(formatCalendarDay("2026-06-21")).toBe("21. 6. 2026");
    expect(formatShortCalendarDay("2026-06-21")).toBe("21. 6.");
    expect(formatCount(1234)).toBe("1\u00a0234");
  });

  it("uses long dates and time in Czech", async () => {
    await i18n.changeLanguage("cs");
    expect(formatLongDay("2026-06-21T12:00:00Z")).toBe("21. června 2026");
    expect(formatLongCalendarDay("2026-06-21")).toBe("21. června 2026");
    expect(formatLongDayAndTime("2026-06-21T12:01:00Z")).toBe("21. června 2026 v 14:01");
  });

  it("keeps ISO dates and date-times in both styles", () => {
    document.documentElement.dataset.dateFormat = "iso";
    expect(formatDay("2026-06-21T12:01:00Z")).toBe("2026-06-21");
    expect(formatLongDay("2026-06-21T12:01:00Z")).toBe("2026-06-21");
    expect(formatCalendarDay("2026-06-21")).toBe("2026-06-21");
    expect(formatLongCalendarDay("2026-06-21")).toBe("2026-06-21");
    expect(formatLongDayAndTime("2026-06-21T12:01:00Z")).toBe("2026-06-21 14:01");
  });
});
