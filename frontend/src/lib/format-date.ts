// Dates as the views print them: a day, "21 Jun 2026", in the demos' en-GB order.
// TODO(rrandiak): the locale comes from i18n.

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDay(timestamp: string): string {
  return dayFormat.format(new Date(timestamp));
}
