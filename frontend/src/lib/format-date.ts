// Dates as the views print them: a day, "21 Jun 2026", in the demos' en-GB order, or without the
// year where the year goes without saying, "21 Jun".
// TODO(rrandiak): the locale comes from i18n.

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const shortDayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export function formatDay(timestamp: string): string {
  return dayFormat.format(new Date(timestamp));
}

// A calendar day, YYYY-MM-DD, read at noon so that no time zone moves it to its neighbour.
export function formatCalendarDay(date: string): string {
  return dayFormat.format(new Date(`${date}T12:00:00`));
}

export function formatShortCalendarDay(date: string): string {
  return shortDayFormat.format(new Date(`${date}T12:00:00`));
}
