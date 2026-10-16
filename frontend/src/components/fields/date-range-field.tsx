// Days between two ends, either open: the Asked filter's custom range now, Tasks' Started and the
// lists' dates later (component-interfaces.md §7, DateRange). Native date inputs, so a phone gets
// its own picker. The presets are the filter's (components/filters/range-filter.tsx).
// TODO(rrandiak): labels move to i18n.

import type { ValueRange } from "@vera/domain/value-range";
import { parseDay } from "@vera/domain/value-range";
import { Input } from "@/components/ui/input";

interface DateRangeFieldProps {
  id: string;
  // "Asked", naming each end for assistive technology.
  label: string;
  value: ValueRange<string>;
  onChange: (value: ValueRange<string>) => void;
}

export function DateRangeField({ id, label, value, onChange }: DateRangeFieldProps) {
  const endOf = (raw: string) => parseDay(raw) ?? undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        id={id}
        type="date"
        aria-label={`${label} from`}
        className="w-40"
        value={value.from ?? ""}
        max={value.to}
        onChange={(event) => onChange({ ...value, from: endOf(event.target.value) })}
      />
      <span className="text-muted-foreground">–</span>
      <Input
        type="date"
        aria-label={`${label} until`}
        className="w-40"
        value={value.to ?? ""}
        min={value.from}
        onChange={(event) => onChange({ ...value, to: endOf(event.target.value) })}
      />
    </div>
  );
}
