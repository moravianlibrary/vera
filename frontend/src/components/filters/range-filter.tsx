// A range field on a view's filter bar: Pages, Asked, Waiting since. There is no Advanced editor
// (decided 2026-10-06): a range is added from "+ Add filter" like any other field, as a chip
// that reads "any" until a value is chosen, and the chip opens what the field takes. A range of
// days offers its presets (recent days or calendar weeks/months), kept as words so a saved
// filter stays relative, or two days; a count offers the field's presets (Pages: under 100 up to
// 1,000 and more), plain ranges, or two ends. Every tier edits it, the phone in
// its filter sheet (filter-sheet.tsx) through the same editor.
// TODO(rrandiak): the rest of filtering.md §3.3 — *not*, *empty* and fields reached through
// another record.

import type { DayPreset, DayRange, ValueRange } from "@vera/domain/value-range";
import { isOpenRange, isReversedRange, recentDayPresets } from "@vera/domain/value-range";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { DateRangeField } from "@/components/fields/date-range-field";
import { NumberRangeField } from "@/components/fields/number-range-field";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { i18n } from "@/i18n";
import { formatDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { cn } from "@/lib/utils";
import type { RangeFieldDefinition } from "@/lib/view-definition";

export type AnyRange = ValueRange<number> | DayRange;

export const dayPresetLabels = {
  "last-7-days": "common:dayPreset.last-7-days",
  "last-14-days": "common:dayPreset.last-14-days",
  "last-30-days": "common:dayPreset.last-30-days",
  "this-week": "common:dayPreset.this-week",
  "last-week": "common:dayPreset.last-week",
  "next-week": "common:dayPreset.next-week",
  "this-month": "common:dayPreset.this-month",
  "last-month": "common:dayPreset.last-month",
  "next-month": "common:dayPreset.next-month",
} as const satisfies Record<DayPreset, string>;

export function rangeOf<Query>(
  query: Query,
  field: RangeFieldDefinition<Query>,
): AnyRange | undefined {
  return query[field.key as keyof Query] as AnyRange | undefined;
}

// "last 7 days"; "≥ 1,000", "200–1,000"; "from 1 Jun 2026", "1 Jun 2026 – 30 Jun 2026".
export function rangeSummaryOf<Query>(field: RangeFieldDefinition<Query>, range: AnyRange): string {
  if ("preset" in range) {
    return i18n.t(dayPresetLabels[range.preset]).toLowerCase();
  }

  const format = (value: number | string) =>
    typeof value === "number" ? formatCount(value) : formatDay(`${value}T12:00:00Z`);
  const { from, to } = range;
  const isDate = field.field.kind === "dateRange";
  if (from !== undefined && to !== undefined) {
    return i18n.t(isDate ? "range.dateBetween" : "range.countBetween", {
      ns: "common",
      from: format(from),
      to: format(to),
    });
  }

  if (from !== undefined) {
    return i18n.t(isDate ? "range.dateFrom" : "range.countFrom", {
      ns: "common",
      from: format(from),
    });
  }

  return i18n.t(isDate ? "range.dateUntil" : "range.countUntil", {
    ns: "common",
    to: format(to ?? (isDate ? "" : 0)),
  });
}

// "Under 100", "100–499", "1,000 and more".
export function countPresetLabelOf({ from, to }: ValueRange<number>): string {
  const format = (value: number) => formatCount(value);
  if (from === undefined) {
    return i18n.t("range.under", {
      ns: "common",
      count: (to ?? 0) + 1,
      formatted: format((to ?? 0) + 1),
    });
  }

  return to === undefined
    ? i18n.t("range.andMore", { ns: "common", from: format(from) })
    : i18n.t("range.countBetween", { ns: "common", from: format(from), to: format(to) });
}

// ---------------------------------------------------------------- the chip

interface RangeChipProps<Query> {
  field: RangeFieldDefinition<Query>;
  // Undefined while it reads "any": just added, nothing chosen yet.
  range: AnyRange | undefined;
  // Just added from "+ Add filter", so its editor opens at once.
  isOpenAtFirst?: boolean;
  onChange: (range: AnyRange) => void;
  onRemove: () => void;
}

export function RangeChip<Query>({
  field,
  range,
  isOpenAtFirst = false,
  onChange,
  onRemove,
}: RangeChipProps<Query>) {
  // View labels may be keys or plain text; missing keys stay unchanged.
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const isSet = range !== undefined;
  // A frame later: opened at once, the menu that added it closing would close it too.
  useEffect(() => {
    if (!isOpenAtFirst) {
      return;
    }

    const frame = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [isOpenAtFirst]);

  return (
    <span
      className={cn(
        "inline-flex h-7 max-w-72 items-center rounded-md border text-xs",
        isSet ? "bg-secondary text-secondary-foreground" : "bg-background text-muted-foreground",
      )}
    >
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger className="inline-flex h-full min-w-0 items-center gap-1 rounded-l-md pr-1 pl-2 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <span className="truncate">
            {t(field.label)}{" "}
            <b className={cn(isSet && "font-semibold")}>
              {isSet ? rangeSummaryOf(field, range) : t("filter.any")}
            </b>
          </span>
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-3">
          <RangeEditor
            field={field}
            range={range}
            onApply={(next) => {
              onChange(next);
              setIsOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("filter.removeNamed", { field: t(field.label) })}
        title={t("filter.remove")}
        className="grid h-full place-items-center rounded-r-md px-1.5 text-muted-foreground outline-none hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------- the editor

interface RangeEditorProps<Query> {
  field: RangeFieldDefinition<Query>;
  range: AnyRange | undefined;
  onApply: (range: AnyRange) => void;
}

// A preset applies at once; two ends apply with Apply, once they say something.
export function RangeEditor<Query>({ field, range, onApply }: RangeEditorProps<Query>) {
  const { t } = useTranslation("common");
  const id = useId();
  const ends = range === undefined || "preset" in range ? {} : range;
  const [draft, setDraft] = useState<ValueRange<number> | ValueRange<string>>(ends);
  const isReversed = isReversedRange(draft);
  const isDate = field.field.kind === "dateRange";
  const datePresets =
    field.field.kind === "dateRange" ? (field.field.presets ?? recentDayPresets) : [];
  const preset = range !== undefined && "preset" in range ? range.preset : null;
  const { presets: countPresets = [], unit = "" } =
    field.field.kind === "numberRange" ? field.field : {};
  const isChosen = (candidate: ValueRange<number>) =>
    range !== undefined &&
    !("preset" in range) &&
    range.from === candidate.from &&
    range.to === candidate.to;

  return (
    <div className="grid gap-3 text-sm">
      {datePresets.length > 0 && (
        <fieldset className="grid gap-1" aria-label={t("range.presets", { field: t(field.label) })}>
          {datePresets.map((value) => (
            <Button
              key={value}
              type="button"
              variant={preset === value ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={preset === value}
              className="justify-start font-normal"
              onClick={() => onApply({ preset: value })}
            >
              {t(dayPresetLabels[value])}
            </Button>
          ))}
        </fieldset>
      )}

      {countPresets.length > 0 && (
        <fieldset className="grid gap-1" aria-label={t("range.presets", { field: t(field.label) })}>
          {countPresets.map((candidate) => (
            <Button
              key={countPresetLabelOf(candidate)}
              type="button"
              variant={isChosen(candidate) ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={isChosen(candidate)}
              className="justify-start font-normal"
              onClick={() => onApply(candidate)}
            >
              {countPresetLabelOf(candidate)} {unit}
            </Button>
          ))}
        </fieldset>
      )}

      <div
        className={cn(
          "grid gap-2",
          (datePresets.length > 0 || countPresets.length > 0) && "border-t pt-3",
        )}
      >
        <span className="text-xs font-medium text-muted-foreground">
          {t(isDate ? "filter.betweenDays" : "filter.between")}
        </span>
        {field.field.kind === "numberRange" ? (
          <NumberRangeField
            id={`${id}-range`}
            label={field.label}
            unit={field.field.unit}
            value={draft as ValueRange<number>}
            onChange={setDraft}
          />
        ) : (
          <DateRangeField
            id={`${id}-range`}
            label={field.label}
            value={draft as ValueRange<string>}
            onChange={setDraft}
          />
        )}
        {isReversed && (
          <p role="alert" className="text-xs text-destructive">
            {t("filter.reversed")}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={isReversed || isOpenRange(draft)}
            onClick={() => onApply(draft)}
          >
            {t("filter.apply")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("range.endsIncluded")}</span>
        </div>
      </div>
    </div>
  );
}
