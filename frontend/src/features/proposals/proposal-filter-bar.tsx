// The Proposals filter bar (filtering.md §3, §6): the search, Decision and Proposal custody on
// the bar, then the other fields as chips with "+ Add filter".
// TODO(rrandiak): Asked and the Advanced editor (filtering.md §3.3); the phone tier's Filter
// sheet; labels move to i18n.

import { Search } from "lucide-react";
import type { z } from "zod";
import { answerSchema, answers } from "@/api/documents";
import type {
  AskerCount,
  ProposalListField,
  ProposalPage,
  ProposalQuery,
} from "@/api/proposal-review";
import { askerCountSchema, askerCounts } from "@/api/proposal-review";
import type { FilterField } from "@/components/filters/filter-controls";
import {
  AddFilterMenu,
  byLabel,
  byOrderOf,
  FilterChip,
  isOneOf,
  optionsOf,
  QuickFilter,
} from "@/components/filters/filter-controls";
import { answerLabels, existingCopyLabels } from "@/components/filters/value-labels";
import { Input } from "@/components/ui/input";
import { existingCopyStateSchema, existingCopyStates } from "@/domain/documents";
import type { DocumentType } from "@/domain/entities";
import { documentTypeSchema } from "@/domain/entities";
import type { ProposalDecision } from "@/domain/proposal-review";
import { proposalDecisionSchema, proposalDecisions } from "@/domain/proposal-review";
import { useProposalCustodiesQuery } from "@/features/proposals/use-proposals-query";
import { useBatchesQuery, useProjectsQuery, useUsersQuery } from "@/hooks/use-reference-query";

export const proposalDecisionLabels = {
  Pending: "Awaiting a decision",
  Denied: "Declined",
  Withdrawn: "Withdrawn",
} as const satisfies Record<ProposalDecision, string>;

const documentTypeLabels = {
  Periodical: "Periodical",
  Monograph: "Monograph",
  Manuscript: "Manuscript",
  Map: "Map",
} as const satisfies Record<DocumentType, string>;

const askerCountLabels = {
  One: "One",
  Several: "More than one",
} as const satisfies Record<AskerCount, string>;

const fieldLabels = {
  decisions: "Decision",
  custodyIds: "Proposal custody",
  documentTypes: "Material type",
  projectIds: "Project",
  existingCopies: "Existing copy",
  askerIds: "Asked by",
  batchIds: "Batch",
  askerCounts: "Askers",
  afterProjectApproval: "After the project's approval",
} as const satisfies Record<ProposalListField, string>;

interface ProposalFilterBarProps {
  query: ProposalQuery;
  // The list's first slice, which carries the counts.
  summary: ProposalPage | undefined;
  onQueryChange: (query: ProposalQuery) => void;
}

export function ProposalFilterBar({ query, summary, onQueryChange }: ProposalFilterBarProps) {
  const { quickFields, chipFields } = useProposalFilterFields({ query, summary, onQueryChange });
  const activeChipFields = chipFields.filter((field) => field.selected.length > 0);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:px-6">
      <div className="relative max-w-88 min-w-44 flex-1">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search proposals"
          className="h-8 pl-8"
          placeholder="Search — title, catalog ID, volume, who asked, batch"
          defaultValue={query.search}
          onChange={(event) => onQueryChange({ ...query, search: event.target.value })}
        />
      </div>

      {quickFields.map((field) => (
        <QuickFilter key={field.key} field={field} />
      ))}

      <div className="flex flex-wrap items-center gap-2">
        {activeChipFields.map((field) => (
          <FilterChip key={field.key} field={field} />
        ))}
        <AddFilterMenu fields={chipFields} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- fields

interface ProposalFilterFields {
  quickFields: FilterField[];
  chipFields: FilterField[];
}

function useProposalFilterFields({
  query,
  summary,
  onQueryChange,
}: ProposalFilterBarProps): ProposalFilterFields {
  const { data: custodies = [] } = useProposalCustodiesQuery();
  const { data: projects = [] } = useProjectsQuery();
  const { data: users = [] } = useUsersQuery();
  const { data: batches = [] } = useBatchesQuery();
  const facets = summary?.facets;

  // A field of a closed vocabulary, its values in the vocabulary's order.
  const enumField = <Value extends string>(
    field: ProposalListField,
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
    field: "custodyIds" | "projectIds" | "askerIds" | "batchIds",
    labelOf: (id: string) => string,
  ): FilterField => ({
    key: field,
    label: fieldLabels[field],
    options: optionsOf(facets?.[field], query[field], labelOf).toSorted(byLabel),
    selected: query[field] ?? [],
    onChange: (values) => onQueryChange({ ...query, [field]: values }),
  });

  const custodyLabelOf = (custodyId: string) =>
    custodies.find((custody) => custody.id === custodyId)?.name ?? custodyId;
  const projectLabelOf = (projectId: string) =>
    projects.find((project) => project.id === projectId)?.name ?? projectId;
  const userLabelOf = (userId: string) => users.find((user) => user.id === userId)?.name ?? userId;
  const batchLabelOf = (batchId: string) => {
    const batch = batches.find((candidate) => candidate.id === batchId);
    return batch === undefined ? batchId : `${batch.id} · ${batch.name}`;
  };

  return {
    quickFields: [
      enumField("decisions", proposalDecisionSchema, proposalDecisions, proposalDecisionLabels),
      referenceField("custodyIds", custodyLabelOf),
    ],
    chipFields: [
      enumField(
        "documentTypes",
        documentTypeSchema,
        documentTypeSchema.options,
        documentTypeLabels,
      ),
      referenceField("projectIds", projectLabelOf),
      enumField(
        "existingCopies",
        existingCopyStateSchema,
        existingCopyStates.toReversed(),
        existingCopyLabels,
      ),
      referenceField("askerIds", userLabelOf),
      referenceField("batchIds", batchLabelOf),
      enumField("askerCounts", askerCountSchema, askerCounts, askerCountLabels),
      enumField("afterProjectApproval", answerSchema, answers, answerLabels),
    ],
  };
}
