// A range over a field's values, for the filters that need more than equality: Pages and Asked
// (filtering.md §2). Either end may be open and both are inclusive. In a URL it is written
// `from..to`, `from..` or `..to`, so `pages=1000..` and `asked=2026-06-01..2026-06-30`; a range
// of days may instead be a preset, `asked=last-7-days`.
// TODO(rrandiak): filtering.md writes `pages=>1000`; settle one syntax with the backend contract.

export interface ValueRange<Value> {
  readonly from?: Value;
  readonly to?: Value;
}

const separator = "..";

// Null for a range with neither end, which filters nothing.
export function formatRange<Value>(
  range: ValueRange<Value> | undefined,
  formatValue: (value: Value) => string = String,
): string | null {
  if (range === undefined || isOpenRange(range)) {
    return null;
  }

  const from = range.from === undefined ? "" : formatValue(range.from);
  const to = range.to === undefined ? "" : formatValue(range.to);
  return `${from}${separator}${to}`;
}

// Undefined for anything malformed, so a stale link still opens the view.
export function parseRange<Value>(
  raw: string | null,
  parseValue: (raw: string) => Value | null,
): ValueRange<Value> | undefined {
  if (raw === null || !raw.includes(separator)) {
    return undefined;
  }

  const [rawFrom = "", rawTo = "", ...rest] = raw.split(separator);
  if (rest.length > 0) {
    return undefined;
  }

  const from = rawFrom.trim() === "" ? undefined : parseValue(rawFrom.trim());
  const to = rawTo.trim() === "" ? undefined : parseValue(rawTo.trim());
  if (from === null || to === null || (from === undefined && to === undefined)) {
    return undefined;
  }

  return { ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }) };
}

export function isOpenRange(range: ValueRange<unknown>): boolean {
  return range.from === undefined && range.to === undefined;
}

export function isWithinRange<Value extends number | string>(
  value: Value,
  range: ValueRange<Value>,
): boolean {
  return (
    (range.from === undefined || value >= range.from) &&
    (range.to === undefined || value <= range.to)
  );
}

// ---------------------------------------------------------------- values

export function parseCount(raw: string): number | null {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

// A calendar day, `2026-06-01`.
export function parseDay(raw: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw ? null : raw;
}

// ---------------------------------------------------------------- day ranges

// The ranges of days asked for most, kept as words rather than days so that a saved filter
// stays "the last 7 days" tomorrow (decided 2026-10-06). The server counts them from its today.
export const dayPresets = ["last-7-days", "last-14-days", "last-30-days", "this-month"] as const;
export type DayPreset = (typeof dayPresets)[number];

// Either two ends, or a preset.
export type DayRange = ValueRange<string> | { readonly preset: DayPreset };

export function isDayPreset(range: DayRange): range is { readonly preset: DayPreset } {
  return "preset" in range;
}

// A preset is written as its word, `asked=last-7-days`; two ends as any other range.
export function formatDayRange(range: DayRange | undefined): string | null {
  if (range === undefined) {
    return null;
  }

  return isDayPreset(range) ? range.preset : formatRange(range);
}

export function parseDayRange(raw: string | null): DayRange | undefined {
  const preset = dayPresets.find((candidate) => candidate === raw);
  return preset === undefined ? parseRange(raw, parseDay) : { preset };
}

// The days a range covers, counted from `today` when it is a preset.
export function resolveDayRange(range: DayRange, today: Date): ValueRange<string> {
  if (!isDayPreset(range)) {
    return range;
  }

  const lastDays = { "last-7-days": 7, "last-14-days": 14, "last-30-days": 30 } as const;
  return range.preset === "this-month"
    ? monthRange(today)
    : lastDaysRange(today, lastDays[range.preset]);
}

// The local calendar day of a moment, as a range end.
export function dayOf(moment: Date): string {
  const month = String(moment.getMonth() + 1).padStart(2, "0");
  const day = String(moment.getDate()).padStart(2, "0");
  return `${moment.getFullYear()}-${month}-${day}`;
}

// The last `count` days, today included.
export function lastDaysRange(today: Date, count: number): ValueRange<string> {
  const first = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (count - 1));
  return { from: dayOf(first), to: dayOf(today) };
}

export function monthRange(today: Date): ValueRange<string> {
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { from: dayOf(first), to: dayOf(last) };
}

// A range whose ends are both set and the wrong way round matches nothing.
export function isReversedRange(range: ValueRange<number | string>): boolean {
  return range.from !== undefined && range.to !== undefined && range.from > range.to;
}
