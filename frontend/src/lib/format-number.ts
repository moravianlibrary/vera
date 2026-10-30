// Counts as the views print them, grouped in thousands: "4,812".
import { i18n } from "@/i18n";

export function formatCount(count: number): string {
  return count.toLocaleString(i18n.language === "cs" ? "cs-CZ" : "en-GB");
}

export function formatPages(count: number): string {
  return `${formatCount(count)} ${formatPageUnit()}`;
}

export function formatPageUnit(): string {
  return i18n.t("common:units.pagesUnit");
}

// A share with one decimal, without a trailing zero: "13.5%", "45%".
export function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}
