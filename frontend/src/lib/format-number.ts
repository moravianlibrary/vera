// Counts as the views print them, grouped in thousands: "4,812".
// TODO(rrandiak): the locale comes from i18n.

export function formatCount(count: number): string {
  return count.toLocaleString("en-GB");
}

// A share with one decimal, without a trailing zero: "13.5%", "45%".
export function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}
