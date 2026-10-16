// The fields that classify an item as it is approved, its category and its priority, and the
// labelled field they sit in. Approving is the one place a person classifies (view-map.md §2),
// whether one proposal, a batch at once or a curator's own items as they are proposed.
// TODO(rrandiak): labels move to i18n.

import { categoryPathOf, leafCategoriesOf } from "@vera/domain/categories";
import type { Priority } from "@vera/domain/entities";
import { priorities, prioritySchema } from "@vera/domain/entities";
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategoriesQuery } from "@/hooks/use-reference-query";

const categorySeparator = " / ";

export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        {label}
        {hint !== undefined && <span className="font-normal text-muted-foreground"> — {hint}</span>}
      </Label>
      {children}
    </div>
  );
}

interface CategorySelectProps {
  id: string;
  value: string | null;
  onChange: (categoryId: string) => void;
}

// Every category with no subcategories, by its whole path.
export function CategorySelect({ id, value, onChange }: CategorySelectProps) {
  const { data: categories = [] } = useCategoriesQuery();
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Choose a category…" />
      </SelectTrigger>
      <SelectContent>
        {leafCategoriesOf(categories).map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {categoryPathOf(categories, category.id)
              .map((step) => step.name)
              .join(categorySeparator)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function categoryLabelOf(
  categories: Parameters<typeof categoryPathOf>[0],
  categoryId: string,
): string {
  return categoryPathOf(categories, categoryId)
    .map((step) => step.name)
    .join(categorySeparator);
}

interface PrioritySelectProps {
  id: string;
  value: Priority;
  onChange: (priority: Priority) => void;
}

// Highest first.
export function PrioritySelect({ id, value, onChange }: PrioritySelectProps) {
  return (
    <Select value={value} onValueChange={(picked) => onChange(prioritySchema.parse(picked))}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {priorities.toReversed().map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
