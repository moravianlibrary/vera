// The names of records other records point at by id, so lists, chips and cards stop each
// writing `users.find(…)?.name ?? id` (component-interfaces.md §9.8). A name not (yet) known
// reads as its id. Only the kinds asked for are fetched.

import { useQuery } from "@tanstack/react-query";
import {
  anyProjectFundingFilterValue,
  noMixFilterValue,
  noProjectFundingFilterValue,
} from "@vera/domain/intentions";
import { can } from "@vera/domain/permissions";
import { listMixes } from "@/api/mix-catalog";
import { categoryLabelOf } from "@/components/classification-fields";
import {
  useBatchesQuery,
  useCategoriesQuery,
  usePluginInstancesQuery,
  useProjectsQuery,
  useRequestCustodiesQuery,
  useUsersQuery,
} from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";

export const referenceKinds = [
  "users",
  "projects",
  "mixes",
  "categories",
  "batches",
  "requestCustodies",
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
  const { data: custodies = [] } = useRequestCustodiesQuery(isNeeded("requestCustodies"));
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
    requestCustodies: nameOf(custodies),
    pluginInstances: nameOf(instances),
  };
}

// Every record of each kind asked for, by id: the values a filter offers to someone who builds
// system watchlists, matched or not (WATCH-personal-system). Plugins named in a defect have no
// list of their own.
export function useReferenceValues(
  kinds: readonly ReferenceKind[],
): Readonly<Record<ReferenceKind, readonly string[]>> {
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
  const { data: custodies = [] } = useRequestCustodiesQuery(isNeeded("requestCustodies"));
  const { data: instances = [] } = usePluginInstancesQuery(isNeeded("pluginInstances"));
  const idsOf = (records: readonly { id: string }[]) => records.map((record) => record.id);

  return {
    users: idsOf(users),
    projects: idsOf(projects),
    mixes: idsOf(mixes),
    categories: idsOf(categories),
    batches: idsOf(batches),
    requestCustodies: idsOf(custodies),
    pluginInstances: idsOf(instances),
  };
}
