// The names of records other records point at by id, so lists, chips and cards stop each
// writing `users.find(…)?.name ?? id` (component-interfaces.md §9.8). A name not (yet) known
// reads as its id. Only the kinds asked for are fetched.

import { categoryLabelOf } from "@/components/classification-fields";
import {
  useBatchesQuery,
  useCategoriesQuery,
  useProjectsQuery,
  useProposalCustodiesQuery,
  useUsersQuery,
} from "@/hooks/use-reference-query";

export const referenceKinds = [
  "users",
  "projects",
  "categories",
  "batches",
  "proposalCustodies",
  "defectPlugins",
] as const;
export type ReferenceKind = (typeof referenceKinds)[number];

export type LabelOf = (id: string) => string;

export function useReferenceLabels(
  kinds: readonly ReferenceKind[],
): Readonly<Record<ReferenceKind, LabelOf>> {
  const isNeeded = (kind: ReferenceKind) => ({ isEnabled: kinds.includes(kind) });
  const { data: users = [] } = useUsersQuery(isNeeded("users"));
  const { data: projects = [] } = useProjectsQuery(isNeeded("projects"));
  const { data: categories = [] } = useCategoriesQuery(isNeeded("categories"));
  const { data: batches = [] } = useBatchesQuery(isNeeded("batches"));
  const { data: custodies = [] } = useProposalCustodiesQuery(isNeeded("proposalCustodies"));

  const nameOf =
    (records: readonly { id: string; name: string }[]): LabelOf =>
    (id) =>
      records.find((record) => record.id === id)?.name ?? id;

  return {
    users: nameOf(users),
    projects: nameOf(projects),
    categories: (id) => categoryLabelOf(categories, id) || id,
    batches: (id) => {
      const batch = batches.find((candidate) => candidate.id === id);
      return batch === undefined ? id : `${batch.id} · ${batch.name}`;
    },
    proposalCustodies: nameOf(custodies),
    // A plugin is named by itself in a defect.
    // TODO(rrandiak): the instance's name once the Plugins resource exists (plugins.md).
    defectPlugins: (id) => id,
  };
}
