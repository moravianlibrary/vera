// A schedule's cadence in words (docs/demos/shared/page-tasks.js `CAD`): Schedules and Tasks say
// when something runs by itself, and Plugins says it of an instance's schedules.

import type { Cadence } from "@vera/domain/schedules";
import { i18n } from "@/i18n";
import { localeOf } from "@/lib/locale";

export function weekdayName(weekday: number): string {
  const date = new Date(Date.UTC(2023, 0, 1 + weekday));
  return new Intl.DateTimeFormat(localeOf(), {
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
}

export function cadenceText(cadence: Cadence): string {
  switch (cadence.every) {
    case "minutes":
      return i18n.t("cadence.everyMinutes", { ns: "common", count: cadence.interval });
    case "hours":
      return cadence.interval === 1
        ? i18n.t("cadence.hourly", { ns: "common" })
        : i18n.t("cadence.everyHours", { ns: "common", count: cadence.interval });
    case "day":
      return i18n.t("cadence.daily", { ns: "common", time: cadence.at });
    case "week":
      return i18n.t("cadence.weekly", {
        ns: "common",
        weekday: weekdayName(cadence.weekday),
        time: cadence.at,
      });
    case "month":
      return i18n.t("cadence.monthly", { ns: "common", day: cadence.day, time: cadence.at });
    case "quarter":
      return i18n.t("cadence.quarterly", { ns: "common", time: cadence.at });
  }
}
