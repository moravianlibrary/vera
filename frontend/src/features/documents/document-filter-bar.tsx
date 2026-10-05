// The Documents filter bar, one line that wraps when narrow (docs/demos/notebook/documents.html),
// read left to right: the search, the quick fields, Mine, then the other fields as chips with
// "+ Add filter" (filtering.md §3, §6). Staff filter on the stored dimensions a status is made
// from, Decision and Progress on the bar; a requester's view has only the search and the status
// of their own ask, and the other fields do not exist for them.
// TODO(rrandiak): the phone tier's single Filter button and sheet (filtering.md §3.3); labels
// move to i18n.

import { Search } from "lucide-react";
import { useId } from "react";
import type { z } from "zod";
import type { Answer, DocumentListField, DocumentPage, DocumentQuery } from "@/api/documents";
import { answerSchema, answers, publicStatusSchema, validationSchema } from "@/api/documents";
import type { FilterField, FilterOption } from "@/components/filters/filter-controls";
import { AddFilterMenu, FilterChip, QuickFilter } from "@/components/filters/filter-controls";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { categoryPathOf } from "@/domain/categories";
import type { AskDecision, ExistingCopyState } from "@/domain/documents";
import {
  askDecisionSchema,
  askDecisions,
  existingCopyStateSchema,
  existingCopyStates,
} from "@/domain/documents";
import type { Priority, Progress } from "@/domain/entities";
import { priorities, prioritySchema, progressSchema, progressValues } from "@/domain/entities";
import type { PublicStatus, Validation } from "@/domain/status";
import { publicStatuses, validations } from "@/domain/status";
import { useCategoriesQuery, useProjectsQuery, useUsersQuery } from "@/hooks/use-reference-query";

const categorySeparator = " › ";

const publicStatusLabels = {
  WaitingForReview: "Waiting for review",
  NotAccepted: "Not accepted",
  Withdrawn: "Withdrawn",
  BeingAdded: "Being added",
  BeingChecked: "Being checked",
  WaitingToBeScheduled: "Waiting to be scheduled",
  Scheduled: "Scheduled",
  Available: "Available",
  OnHold: "On hold",
  NotAvailable: "Not available",
} as const satisfies Record<PublicStatus, string>;

const decisionLabels = {
  Pending: "Pending",
  Approved: "Approved",
  Denied: "Denied",
  Withdrawn: "Withdrawn",
} as const satisfies Record<AskDecision, string>;

const progressLabels = {
  Enqueued: "Being added",
  IngestFailed: "Could not be added",
  Ready: "Ready",
  Planned: "Planned",
  InProgress: "In progress",
  Digitized: "Digitized",
  Published: "Published",
} as const satisfies Record<Progress, string>;

const validationLabels = {
  Needed: "Needed",
  Denied: "Denied",
  Approved: "Approved",
  NotRequired: "Not required",
} as const satisfies Record<Validation, string>;

const priorityLabels = {
  Urgent: "Urgent",
  High: "High",
  Normal: "Normal",
  Low: "Low",
} as const satisfies Record<Priority, string>;

const answerLabels = { Yes: "Yes", No: "No" } as const satisfies Record<Answer, string>;

const existingCopyLabels = {
  None: "No copy",
  CheckFailed: "Check failed",
  Unmapped: "Unmapped",
  Planned: "Planned",
  InProgress: "In progress",
  Digitized: "Digitized",
  Published: "Published",
} as const satisfies Record<ExistingCopyState, string>;

interface DocumentFilterBarProps {
  query: DocumentQuery;
  // The list's first slice, which carries the counts.
  summary: DocumentPage | undefined;
  isPublic: boolean;
  onQueryChange: (query: DocumentQuery) => void;
}

export function DocumentFilterBar({
  query,
  summary,
  isPublic,
  onQueryChange,
}: DocumentFilterBarProps) {
  const mineId = useId();
  const { quickFields, chipFields } = useDocumentFilterFields({
    query,
    summary,
    isPublic,
    onQueryChange,
  });
  const activeChipFields = chipFields.filter((field) => field.selected.length > 0);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:px-6">
      <div className="relative max-w-88 min-w-44 flex-1">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search documents"
          className="h-8 pl-8"
          placeholder={
            isPublic
              ? "Search my documents…"
              : "Search — title, catalog ID, volume, signature, cnb…"
          }
          defaultValue={query.search}
          onChange={(event) => onQueryChange({ ...query, search: event.target.value })}
        />
      </div>

      {quickFields.map((field) => (
        <QuickFilter key={field.key} field={field} />
      ))}

      {!isPublic && (
        <div className="flex h-7 items-center gap-1.5 px-1">
          <Checkbox
            id={mineId}
            checked={query.isMine === true}
            onCheckedChange={(isChecked) =>
              onQueryChange({ ...query, isMine: isChecked === true || undefined })
            }
          />
          <Label htmlFor={mineId} className="text-xs font-normal">
            Mine
          </Label>
        </div>
      )}

      {chipFields.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChipFields.map((field) => (
            <FilterChip key={field.key} field={field} />
          ))}
          <AddFilterMenu fields={chipFields} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- fields

interface DocumentFilterFields {
  // On the bar itself, at most two (filtering.md §3.1).
  quickFields: FilterField[];
  // Under "+ Add filter", in the order the picker lists them.
  chipFields: FilterField[];
}

// The declared fields of the view (filtering.md §6).
function useDocumentFilterFields({
  query,
  summary,
  isPublic,
  onQueryChange,
}: DocumentFilterBarProps): DocumentFilterFields {
  const isEnabled = !isPublic;
  const { data: categories = [] } = useCategoriesQuery({ isEnabled });
  const { data: projects = [] } = useProjectsQuery({ isEnabled });
  const { data: users = [] } = useUsersQuery({ isEnabled });
  const facets = summary?.facets;

  // A field of a closed vocabulary, its values in the vocabulary's order.
  const enumField = <Value extends string>(
    field: DocumentListField,
    schema: z.ZodType<Value>,
    order: readonly Value[],
    labels: Record<Value, string>,
  ): FilterField => ({
    key: field,
    label: fieldLabels[field],
    options: optionsOf<string>(facets?.[field], query[field], (value) =>
      isOneOf(schema)(value) ? labels[value] : value,
    ).toSorted(byOrderOf(order)),
    selected: query[field] ?? [],
    onChange: (values) => onQueryChange({ ...query, [field]: values.filter(isOneOf(schema)) }),
  });

  // A field of references, its values by name.
  const referenceField = (
    field: "categoryIds" | "projectIds" | "askerIds",
    labelOf: (id: string) => string,
  ): FilterField => ({
    key: field,
    label: fieldLabels[field],
    options: optionsOf(facets?.[field], query[field], labelOf).toSorted(byLabel),
    selected: query[field] ?? [],
    onChange: (values) => onQueryChange({ ...query, [field]: values }),
  });

  if (isPublic) {
    return {
      quickFields: [enumField("statuses", publicStatusSchema, publicStatuses, publicStatusLabels)],
      chipFields: [],
    };
  }

  const categoryLabelOf = (categoryId: string) =>
    categoryPathOf(categories, categoryId)
      .map((category) => category.name)
      .join(categorySeparator) || categoryId;
  const projectLabelOf = (projectId: string) =>
    projects.find((project) => project.id === projectId)?.name ?? projectId;
  const userLabelOf = (userId: string) => users.find((user) => user.id === userId)?.name ?? userId;

  return {
    quickFields: [
      enumField("decisions", askDecisionSchema, askDecisions, decisionLabels),
      enumField("progress", progressSchema, progressValues, progressLabels),
    ],
    chipFields: [
      enumField("validations", validationSchema, validations, validationLabels),
      enumField("restricted", answerSchema, answers, answerLabels),
      enumField("cancelled", answerSchema, answers, answerLabels),
      referenceField("categoryIds", categoryLabelOf),
      referenceField("projectIds", projectLabelOf),
      enumField("priorities", prioritySchema, priorities.toReversed(), priorityLabels),
      enumField(
        "existingCopies",
        existingCopyStateSchema,
        existingCopyStates.toReversed(),
        existingCopyLabels,
      ),
      referenceField("askerIds", userLabelOf),
    ],
  };
}

const fieldLabels = {
  statuses: "Status",
  decisions: "Decision",
  progress: "Progress",
  validations: "Validation",
  restricted: "Restricted",
  cancelled: "Cancelled",
  categoryIds: "Category",
  projectIds: "Project",
  priorities: "Priority",
  existingCopies: "Existing copy",
  askerIds: "Asked by",
} as const satisfies Record<DocumentListField, string>;

interface FacetCount<Value extends string> {
  value: Value;
  count: number;
}

// The values with a match, plus any picked value that no longer has one, so its chip still reads.
function optionsOf<Value extends string>(
  counts: readonly FacetCount<Value>[] | undefined,
  selected: readonly Value[] | undefined,
  labelOf: (value: Value) => string,
): FilterOption[] {
  const counted = counts ?? [];
  const unmatched = (selected ?? [])
    .filter((value) => !counted.some((entry) => entry.value === value))
    .map((value) => ({ value, count: 0 }));

  return [...counted, ...unmatched].map(({ value, count }) => ({
    value,
    label: labelOf(value),
    count,
  }));
}

function byLabel(first: FilterOption, second: FilterOption): number {
  return first.label.localeCompare(second.label);
}

function byOrderOf(order: readonly string[]) {
  return (first: FilterOption, second: FilterOption): number =>
    order.indexOf(first.value) - order.indexOf(second.value);
}

function isOneOf<Value extends string>(schema: z.ZodType<Value>) {
  return (value: string): value is Value => schema.safeParse(value).success;
}
