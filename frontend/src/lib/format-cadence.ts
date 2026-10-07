// A schedule's cadence in words (docs/demos/shared/page-tasks.js `CAD`): Schedules and Tasks say
// when something runs by itself, and Plugins says it of an instance's schedules.
// TODO(rrandiak): labels move to i18n.

import type { Cadence } from "@/domain/schedules";

const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function weekdayName(weekday: number): string {
  return weekdayNames[weekday] ?? "";
}

export function cadenceText(cadence: Cadence): string {
  switch (cadence.every) {
    case "minutes":
      return `every ${cadence.interval} min`;
    case "hours":
      return cadence.interval === 1 ? "hourly" : `every ${cadence.interval} hours`;
    case "day":
      return `daily at ${cadence.at}`;
    case "week":
      return `weekly, ${weekdayName(cadence.weekday)} ${cadence.at}`;
    case "month":
      return `monthly, day ${cadence.day} at ${cadence.at}`;
    case "quarter":
      return `quarterly, day 1 at ${cadence.at}`;
  }
}
