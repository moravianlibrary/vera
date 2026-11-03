// Dates as the views print them, in the interface language (UI-language), in one of two styles
// chosen by where the date sits, the same choice in every language: the long style in a sentence
// or a detail field, "21 June 2026" / "21. června 2026"; the compact one in a table cell, a meta
// line, a range or an axis, "21 Jun 2026" / "21. 6. 2026", or without the year where the year goes
// without saying, "21 Jun" / "21. 6.". The ISO setting prints YYYY-MM-DD (and HH:MM) in both.
import { localeOf } from "@/lib/locale";

const longDayFormat = () =>
  new Intl.DateTimeFormat(localeOf(), { day: "numeric", month: "long", year: "numeric" });
const dayFormat = () =>
  new Intl.DateTimeFormat(localeOf(), { day: "numeric", month: "short", year: "numeric" });
const shortDayFormat = () =>
  new Intl.DateTimeFormat(localeOf(), { day: "numeric", month: "short" });
const longDayTimeFormat = () =>
  new Intl.DateTimeFormat(localeOf(), {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isIso(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.dateFormat === "iso";
}

export function formatDay(timestamp: string): string {
  const date = new Date(timestamp);
  return isIso() ? isoDay(date) : dayFormat().format(date);
}

export function formatLongDay(timestamp: string): string {
  const date = new Date(timestamp);
  return isIso() ? isoDay(date) : longDayFormat().format(date);
}

// A calendar day, YYYY-MM-DD, read at noon so that no time zone moves it to its neighbour.
export function formatCalendarDay(date: string): string {
  if (isIso()) return date.slice(0, 10);
  return dayFormat().format(new Date(`${date}T12:00:00`));
}

export function formatLongCalendarDay(date: string): string {
  if (isIso()) return date.slice(0, 10);
  return longDayFormat().format(new Date(`${date}T12:00:00`));
}

export function formatShortCalendarDay(date: string): string {
  if (isIso()) return date.slice(0, 10);
  return shortDayFormat().format(new Date(`${date}T12:00:00`));
}

export function formatLongDayAndTime(timestamp: string): string {
  const date = new Date(timestamp);
  return isIso()
    ? `${isoDay(date)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
    : longDayTimeFormat().format(date);
}
