// A set picked one at a time: each picked row with a way to remove it, and a select that adds the
// next and goes back to its placeholder. Project members and category custody pick people and
// groups this way, until PickerDialog (component-interfaces.md §6.6) is built.
// TODO(rrandiak): labels move to i18n.

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RemoveButton({ label, onSelect }: { label: string; onSelect: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="size-7" aria-label={label} onClick={onSelect}>
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
  return (
    <Select value="" onValueChange={onAdd}>
      <SelectTrigger className="w-full sm:w-64" aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
