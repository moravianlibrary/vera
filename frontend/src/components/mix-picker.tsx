import type { MixRecord } from "@vera/contract/mix-catalog";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const allMixesValue = "__all_mixes__";

interface MixPickerProps {
  id: string;
  mixes: readonly MixRecord[];
  value: string;
  onValueChange: (value: string) => void;
  includeAll?: boolean;
  includeArchived?: boolean;
}

export function MixPicker({
  id,
  mixes,
  value,
  onValueChange,
  includeAll = false,
  includeArchived = false,
}: MixPickerProps) {
  const { t } = useTranslation("common");
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Label htmlFor={id} className="shrink-0 text-xs text-muted-foreground">
        {t("mixPicker.mix")}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="h-8 w-full min-w-0 md:w-60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {includeAll && <SelectItem value={allMixesValue}>{t("mixPicker.all")}</SelectItem>}
          {mixes
            .filter((mix) => includeArchived || mix.archivedAt === null)
            .map((mix) => (
              <SelectItem key={mix.id} value={mix.id}>
                {mix.name}
                {mix.isPrimary ? ` (${t("mixPicker.primary")})` : ""}
                {mix.archivedAt !== null ? ` (${t("mixPicker.archived")})` : ""}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}
