// A count between two ends, either open: the Pages filter (filtering.md §2, range). Both ends are
// included; an empty end is open.

import type { ValueRange } from "@vera/domain/value-range";
import { parseCount } from "@vera/domain/value-range";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";

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
  // Labels and units may be message keys or plain text; missing keys remain unchanged.
  const { t } = useTranslation("common");
  const endOf = (raw: string) => parseCount(raw.trim()) ?? undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        id={id}
        inputMode="numeric"
        aria-label={t("range.from", { field: t(label) })}
        placeholder={t("range.fromPlaceholder")}
        className="w-28"
        value={value.from ?? ""}
        onChange={(event) => onChange({ ...value, from: endOf(event.target.value) })}
      />
      <span className="text-muted-foreground">–</span>
      <Input
        inputMode="numeric"
        aria-label={t("range.to", { field: t(label) })}
        placeholder={t("range.toPlaceholder")}
        className="w-28"
        value={value.to ?? ""}
        onChange={(event) => onChange({ ...value, to: endOf(event.target.value) })}
      />
      <span className="text-xs text-muted-foreground">{t(unit)}</span>
    </div>
  );
}
