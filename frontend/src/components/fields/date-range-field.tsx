// Days between two ends, either open, with the ranges asked for most as presets: the Asked filter
// now, Tasks' Started and the lists' dates later (component-interfaces.md §7, DateRange). Native
// date inputs, so a phone gets its own picker.
// TODO(rrandiak): labels move to i18n.

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ValueRange } from "@/lib/value-range";
import { lastDaysRange, monthRange, parseDay } from "@/lib/value-range";

interface DateRangeFieldProps {
  id: string;
  // "Asked", naming each end for assistive technology.
  label: string;
  value: ValueRange<string>;
  onChange: (value: ValueRange<string>) => void;
  // The day the presets count back from; today unless a test says otherwise.
  today?: Date;
}

export function DateRangeField({
  id,
  label,
  value,
  onChange,
  today = new Date(),
}: DateRangeFieldProps) {
  const endOf = (raw: string) => parseDay(raw) ?? undefined;
  const presets = [
    { label: "Last 7 days", range: lastDaysRange(today, 7) },
    { label: "This month", range: monthRange(today) },
  ];

  return (
    <div className="grid gap-2">
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
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onChange(preset.range)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
