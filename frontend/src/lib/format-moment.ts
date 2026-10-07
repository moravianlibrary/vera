// A moment worded against the server's own (`asOf`), since the server's clock, not the
// browser's, says how long ago something happened or how soon it is due: "12 min ago", "today
// 06:00", "tomorrow 02:00". Tasks and Schedules word runs with it, Users & Groups a last login.
// TODO(rrandiak): labels and the locale move to i18n.

const minuteMilliseconds = 60_000;

const clockFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const shortDayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const weekdayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

export function clockTimeOf(moment: string | Date): string {
  return clockFormat.format(new Date(moment));
}

// "14 Jun".
export function shortDayOf(moment: string | Date): string {
  return shortDayFormat.format(new Date(moment));
}

// "25 Jun 10:38".
export function dayAndTimeOf(moment: string | Date): string {
  const date = new Date(moment);
  return `${shortDayFormat.format(date)} ${clockFormat.format(date)}`;
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
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const days = daysBetween(at, now);
  if (days === 0) {
    return `today ${clockTimeOf(at)}`;
  }

  return days === 1 ? `yesterday ${clockTimeOf(at)}` : dayAndTimeOf(at);
}

// "in 5 min", "today 18:00", "tomorrow 02:00", "Mon 29 Jun 06:00".
export function aheadText(moment: string, asOf: string): string {
  const at = new Date(moment);
  const now = new Date(asOf);
  const minutes = Math.round((at.getTime() - now.getTime()) / minuteMilliseconds);
  if (minutes < 60) {
    return `in ${Math.max(1, minutes)} min`;
  }

  const days = daysBetween(now, at);
  if (days === 0) {
    return `today ${clockTimeOf(at)}`;
  }

  return days === 1
    ? `tomorrow ${clockTimeOf(at)}`
    : `${weekdayFormat.format(at)} ${dayAndTimeOf(at)}`;
}
