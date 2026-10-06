// A count between two ends, either open: the Pages filter (filtering.md §2, range). Both ends are
// included; an empty end is open.
// TODO(rrandiak): labels move to i18n.

import { Input } from "@/components/ui/input";
import type { ValueRange } from "@/lib/value-range";
import { parseCount } from "@/lib/value-range";

interface NumberRangeFieldProps {
  id: string;
  // "Pages", naming each end for assistive technology.
  label: string;
  // "pages", after the second end.
  unit: string;
  value: ValueRange<number>;
  onChange: (value: ValueRange<number>) => void;
}

export function NumberRangeField({ id, label, unit, value, onChange }: NumberRangeFieldProps) {
  const endOf = (raw: string) => parseCount(raw.trim()) ?? undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        id={id}
        inputMode="numeric"
        aria-label={`${label} from`}
        placeholder="from"
        className="w-28"
        value={value.from ?? ""}
        onChange={(event) => onChange({ ...value, from: endOf(event.target.value) })}
      />
      <span className="text-muted-foreground">–</span>
      <Input
        inputMode="numeric"
        aria-label={`${label} to`}
        placeholder="to"
        className="w-28"
        value={value.to ?? ""}
        onChange={(event) => onChange({ ...value, to: endOf(event.target.value) })}
      />
      <span className="text-xs text-muted-foreground">{unit}</span>
    </div>
  );
}
