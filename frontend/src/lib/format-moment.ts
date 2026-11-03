// A moment worded against the server's own (`asOf`), since the server's clock, not the
// browser's, says how long ago something happened or how soon it is due: "12 min ago", "today
// 06:00", "tomorrow 02:00". Tasks and Schedules word runs with it, Users & Groups a last login.
import { i18n } from "@/i18n";
import { localeOf } from "@/lib/locale";

const minuteMilliseconds = 60_000;

const clockFormat = () =>
  new Intl.DateTimeFormat(localeOf(), { hour: "2-digit", minute: "2-digit" });
const shortDayFormat = () =>
  new Intl.DateTimeFormat(localeOf(), { day: "numeric", month: "short" });
const weekdayFormat = () => new Intl.DateTimeFormat(localeOf(), { weekday: "short" });

export function clockTimeOf(moment: string | Date): string {
  return clockFormat().format(new Date(moment));
}

// "14 Jun".
export function shortDayOf(moment: string | Date): string {
  return shortDayFormat().format(new Date(moment));
}

// "25 Jun 10:38".
export function dayAndTimeOf(moment: string | Date): string {
  const date = new Date(moment);
  return i18n.t("moment.dayAndTime", {
    ns: "common",
    day: shortDayFormat().format(date),
    time: clockFormat().format(date),
  });
}

// Whole days between the two moments' dates, in the library's own time.
function daysBetween(from: Date, to: Date): number {
  const startOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round(
    (startOf(to).getTime() - startOf(from).getTime()) / (24 * 60 * minuteMilliseconds),
  );
}

// "just now", "12 min ago", "today 06:00", "yesterday 14:05", "22 Jun 14:05".
export function agoText(moment: string, asOf: string): string {
  const at = new Date(moment);
  const now = new Date(asOf);
  const minutes = Math.round((now.getTime() - at.getTime()) / minuteMilliseconds);
  if (minutes < 1) {
    return i18n.t("moment.justNow", { ns: "common" });
  }

  if (minutes < 60) {
    return i18n.t("moment.minutesAgo", { ns: "common", count: minutes });
  }

  const days = daysBetween(at, now);
  if (days === 0) {
    return i18n.t("moment.today", { ns: "common", time: clockTimeOf(at) });
  }

  return days === 1
    ? i18n.t("moment.yesterday", { ns: "common", time: clockTimeOf(at) })
    : dayAndTimeOf(at);
}

// "in 5 min", "today 18:00", "tomorrow 02:00", "Mon 29 Jun 06:00".
export function aheadText(moment: string, asOf: string): string {
  const at = new Date(moment);
  const now = new Date(asOf);
  const minutes = Math.round((at.getTime() - now.getTime()) / minuteMilliseconds);
  if (minutes < 60) {
    return i18n.t("moment.inMinutes", { ns: "common", count: Math.max(1, minutes) });
  }

  const days = daysBetween(now, at);
  if (days === 0) {
    return i18n.t("moment.today", { ns: "common", time: clockTimeOf(at) });
  }

  return days === 1
    ? i18n.t("moment.tomorrow", { ns: "common", time: clockTimeOf(at) })
    : i18n.t("moment.weekdayAndTime", {
        ns: "common",
        weekday: weekdayFormat().format(at),
        dayAndTime: dayAndTimeOf(at),
      });
}
