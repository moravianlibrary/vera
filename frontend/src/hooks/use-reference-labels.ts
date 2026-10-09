// The names of records other records point at by id, so lists, chips and cards stop each
// writing `users.find(…)?.name ?? id` (component-interfaces.md §9.8). A name not (yet) known
// reads as its id. Only the kinds asked for are fetched.

import { useQuery } from "@tanstack/react-query";
import { listMixes } from "@/api/mix-catalog";
import { categoryLabelOf } from "@/components/classification-fields";
import {
  anyProjectFundingFilterValue,
  noMixFilterValue,
  noProjectFundingFilterValue,
} from "@/domain/intentions";
import { can } from "@/domain/permissions";
import {
  useBatchesQuery,
  useCategoriesQuery,
  usePluginInstancesQuery,
  useProjectsQuery,
  useProposalCustodiesQuery,
  useUsersQuery,
} from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";

export const referenceKinds = [
  "users",
  "projects",
  "mixes",
  "categories",
  "batches",
  "proposalCustodies",
  "defectPlugins",
  "pluginInstances",
] as const;
export type ReferenceKind = (typeof referenceKinds)[number];

export type LabelOf = (id: string) => string;

export function useReferenceLabels(
  kinds: readonly ReferenceKind[],
): Readonly<Record<ReferenceKind, LabelOf>> {
  const isNeeded = (kind: ReferenceKind) => ({ isEnabled: kinds.includes(kind) });
  const { data: session } = useSessionQuery();
  const { data: users = [] } = useUsersQuery(isNeeded("users"));
  const { data: projects = [] } = useProjectsQuery(isNeeded("projects"));
  const { data: mixes = [] } = useQuery({
    queryKey: ["mixes"],
    queryFn: listMixes,
    enabled: kinds.includes("mixes") && session !== undefined && can(session, "mix.read"),
  });
  const { data: categories = [] } = useCategoriesQuery(isNeeded("categories"));
  const { data: batches = [] } = useBatchesQuery(isNeeded("batches"));
  const { data: custodies = [] } = useProposalCustodiesQuery(isNeeded("proposalCustodies"));
  const { data: instances = [] } = usePluginInstancesQuery(isNeeded("pluginInstances"));

  const nameOf =
    (records: readonly { id: string; name: string }[]): LabelOf =>
    (id) =>
      records.find((record) => record.id === id)?.name ?? id;

  return {
    users: nameOf(users),
    projects: (id) =>
      id === noProjectFundingFilterValue
        ? "No project"
        : id === anyProjectFundingFilterValue
          ? "Any project"
          : nameOf(projects)(id),
    mixes: (id) => (id === noMixFilterValue ? "No mix" : nameOf(mixes)(id)),
    categories: (id) => categoryLabelOf(categories, id) || id,
    batches: (id) => {
      const batch = batches.find((candidate) => candidate.id === id);
      return batch === undefined ? id : `${batch.id} · ${batch.name}`;
    },
    proposalCustodies: nameOf(custodies),
    // A plugin is named by itself in a defect.
    // TODO(rrandiak): the instance's name once the Plugins resource exists (plugins.md).
    defectPlugins: (id) => id,
    pluginInstances: nameOf(instances),
  };
}
