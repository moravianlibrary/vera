// Counts as the views print them, grouped in thousands: "4,812".
// TODO(rrandiak): the locale comes from i18n.

export function formatCount(count: number): string {
  return count.toLocaleString("en-GB");
}
