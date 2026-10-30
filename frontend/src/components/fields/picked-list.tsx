// A set picked one at a time: each picked row with a way to remove it, and a select that adds the
// next and goes back to its placeholder. Project members and category custody pick people and
// groups this way, until PickerDialog (component-interfaces.md §6.6) is built.
// Labels supplied by callers are translated here; plain text falls through unchanged.

import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RemoveButton({ label, onSelect }: { label: string; onSelect: () => void }) {
  const { t } = useTranslation("common");
  return (
    <Button variant="ghost" size="icon" className="size-7" aria-label={t(label)} onClick={onSelect}>
      <X className="size-3.5" />
    </Button>
  );
}

interface AddSelectProps {
  placeholder: string;
  options: readonly { value: string; label: string }[];
  onAdd: (value: string) => void;
}

export function AddSelect({ placeholder, options, onAdd }: AddSelectProps) {
  const { t } = useTranslation("common");
  return (
    <Select value="" onValueChange={onAdd}>
      <SelectTrigger className="w-full sm:w-64" aria-label={t(placeholder)}>
        <SelectValue placeholder={t(placeholder)} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {t(option.label)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
