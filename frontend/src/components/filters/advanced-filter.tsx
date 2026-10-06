// The advanced depth of a view's filter (filtering.md §3.3): the fields that need more than
// equality, Pages and Asked, edited together. Only notebook (in a dialog) and large (in a panel
// under the bar) build them (component-interfaces.md §3.2); every tier shows a set range as a
// chip that can be removed, never dropped (view-rules.md §2, rule 1).
// TODO(rrandiak): the rest of §3.3 — every chip as a row with its operator, *not*, *empty* and
// fields reached through another record; labels move to i18n.

import { X } from "lucide-react";
import { useId, useState } from "react";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { DateRangeField } from "@/components/fields/date-range-field";
import { NumberRangeField } from "@/components/fields/number-range-field";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/format-date";
import type { ValueRange } from "@/lib/value-range";
import { isOpenRange, isReversedRange } from "@/lib/value-range";
import type { RangeFieldDefinition } from "@/lib/view-definition";

type AnyRange = ValueRange<number> | ValueRange<string>;

export function rangeOf<Query>(
  query: Query,
  field: RangeFieldDefinition<Query>,
): AnyRange | undefined {
  return query[field.key as keyof Query] as AnyRange | undefined;
}

// "≥ 1,000", "200–1,000"; "from 1 Jun 2026", "1 Jun 2026 – 30 Jun 2026".
export function rangeSummaryOf<Query>(field: RangeFieldDefinition<Query>, range: AnyRange): string {
  const format = (value: number | string) =>
    typeof value === "number" ? value.toLocaleString("en-GB") : formatDay(`${value}T12:00:00Z`);
  const { from, to } = range;
  const isDate = field.field.kind === "dateRange";
  if (from !== undefined && to !== undefined) {
    return isDate ? `${format(from)} – ${format(to)}` : `${format(from)}–${format(to)}`;
  }

  if (from !== undefined) {
    return isDate ? `from ${format(from)}` : `≥ ${format(from)}`;
  }

  return isDate ? `until ${format(to ?? "")}` : `≤ ${format(to ?? 0)}`;
}

interface RangeChipProps {
  label: string;
  summary: string;
  onRemove: () => void;
  // Reopens the Advanced editor where the tier builds it; elsewhere the chip only reads.
  onOpen?: () => void;
}

export function RangeChip({ label, summary, onRemove, onOpen }: RangeChipProps) {
  const text = (
    <span className="truncate">
      {label} <b className="font-semibold">{summary}</b>
    </span>
  );

  return (
    <span className="inline-flex h-7 max-w-72 items-center rounded-md border bg-secondary text-xs text-secondary-foreground">
      {onOpen === undefined ? (
        <span className="inline-flex min-w-0 items-center pr-1 pl-2">{text}</span>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-full min-w-0 items-center rounded-l-md pr-1 pl-2 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {text}
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove the ${label} filter`}
        title="Remove this filter"
        className="grid h-full place-items-center rounded-r-md px-1.5 text-muted-foreground outline-none hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

interface AdvancedFilterProps<Query> {
  // A dialog at notebook, a panel under the bar at large.
  presentation: "dialog" | "panel";
  onClose: () => void;
  fields: readonly RangeFieldDefinition<Query>[];
  query: Query;
  onApply: (query: Query) => void;
}

// Mounted while open, so each opening starts from the filter as it is.
export function AdvancedFilter<Query>({
  presentation,
  onClose,
  fields,
  query,
  onApply,
}: AdvancedFilterProps<Query>) {
  const id = useId();
  const [draft, setDraft] = useState<Readonly<Record<string, AnyRange>>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, rangeOf(query, field) ?? {}])),
  );
  const draftOf = (field: RangeFieldDefinition<Query>) => draft[field.key] ?? {};
  const isReversed = fields.some((field) => isReversedRange(draftOf(field)));

  const apply = () => {
    const ranges = Object.fromEntries(
      fields.map((field) => {
        const range = draftOf(field);
        return [field.key, isOpenRange(range) ? undefined : range];
      }),
    );
    onApply({ ...query, ...ranges });
    onClose();
  };

  const rows = (
    <div className="grid gap-4">
      {fields.map((field) => {
        const fieldId = `${id}-${field.key}`;
        const change = (range: AnyRange) =>
          setDraft((current) => ({ ...current, [field.key]: range }));
        return (
          <div key={field.key} className="grid gap-1.5 sm:grid-cols-[6rem_minmax(0,1fr)]">
            <label htmlFor={fieldId} className="pt-2 text-sm font-medium">
              {field.label}
            </label>
            <div className="grid gap-1">
              {field.field.kind === "numberRange" ? (
                <NumberRangeField
                  id={fieldId}
                  label={field.label}
                  unit={field.field.unit}
                  value={draftOf(field) as ValueRange<number>}
                  onChange={change}
                />
              ) : (
                <DateRangeField
                  id={fieldId}
                  label={field.label}
                  value={draftOf(field) as ValueRange<string>}
                  onChange={change}
                />
              )}
              {isReversedRange(draftOf(field)) && (
                <p role="alert" className="text-xs text-destructive">
                  The first end is after the second.
                </p>
              )}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">Both ends are included; an empty end is open.</p>
    </div>
  );

  if (presentation === "dialog") {
    return (
      <DialogShell
        isOpen
        onClose={onClose}
        title="Advanced filter"
        description="Filter by ranges rather than by values."
        primary={{ label: "Apply", isDisabled: isReversed, onSelect: apply }}
      >
        {rows}
      </DialogShell>
    );
  }

  return (
    <section
      aria-label="Advanced filter"
      className="shrink-0 border-b bg-muted/40 px-4 py-3 sm:px-6"
    >
      {rows}
      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={isReversed} onClick={apply}>
          Apply
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
