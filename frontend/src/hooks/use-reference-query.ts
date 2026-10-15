// Reference data views resolve names through. It changes rarely, so it is fetched once per visit.

import { useQuery } from "@tanstack/react-query";
import { listProposalCustodies } from "@/api/proposal-review";
import {
  listBatches,
  listCategories,
  listDigitizationLists,
  listGroups,
  listPluginInstances,
  listProjects,
  listRoles,
  listUsers,
} from "@/api/reference";
import { isShownAsBatch } from "@/domain/documents";

export const referenceQueryKey = ["reference"] as const;

interface ReferenceQueryOptions {
  // Off where the view has no field that needs the names.
  isEnabled?: boolean;
}

export function useUsersQuery({ isEnabled = true }: ReferenceQueryOptions = {}) {
  return useQuery({
    queryKey: [...referenceQueryKey, "users"],
    queryFn: listUsers,
    staleTime: Infinity,
    enabled: isEnabled,
  });
}

export function useGroupsQuery({ isEnabled = true }: ReferenceQueryOptions = {}) {
  return useQuery({
    queryKey: [...referenceQueryKey, "groups"],
    queryFn: listGroups,
    staleTime: Infinity,
    enabled: isEnabled,
  });
}

export function useRolesQuery({ isEnabled = true }: ReferenceQueryOptions = {}) {
  return useQuery({
    queryKey: [...referenceQueryKey, "roles"],
    queryFn: listRoles,
    staleTime: Infinity,
    enabled: isEnabled,
  });
}

export function useCategoriesQuery({ isEnabled = true }: ReferenceQueryOptions = {}) {
  return useQuery({
    queryKey: [...referenceQueryKey, "categories"],
    queryFn: listCategories,
    staleTime: Infinity,
    enabled: isEnabled,
  });
}

export function useProjectsQuery({ isEnabled = true }: ReferenceQueryOptions = {}) {
  return useQuery({
    queryKey: [...referenceQueryKey, "projects"],
    queryFn: listProjects,
    staleTime: Infinity,
    enabled: isEnabled,
  });
}

export function useDigitizationListsQuery({ isEnabled = true }: ReferenceQueryOptions = {}) {
  return useQuery({
    queryKey: [...referenceQueryKey, "lists"],
    queryFn: listDigitizationLists,
    staleTime: Infinity,
    enabled: isEnabled,
  });
}

export function useBatchesQuery({ isEnabled = true }: ReferenceQueryOptions = {}) {
  return useQuery({
    queryKey: [...referenceQueryKey, "batches"],
    queryFn: listBatches,
    staleTime: Infinity,
    enabled: isEnabled,
  });
}

// Whether a batch is shown as one: a batch of one is not (ENT-batch).
export function useIsShownBatch(): (batchId: string) => boolean {
  const { data: batches = [] } = useBatchesQuery();
  return (batchId) => batches.some((batch) => batch.id === batchId && isShownAsBatch(batch));
}

export function useProposalCustodiesQuery({ isEnabled = true }: ReferenceQueryOptions = {}) {
  return useQuery({
    queryKey: [...referenceQueryKey, "proposalCustodies"],
    queryFn: listProposalCustodies,
    staleTime: Infinity,
    enabled: isEnabled,
  });
}

export function usePluginInstancesQuery({ isEnabled = true }: ReferenceQueryOptions = {}) {
  return useQuery({
    queryKey: [...referenceQueryKey, "pluginInstances"],
    queryFn: listPluginInstances,
    staleTime: Infinity,
    enabled: isEnabled,
  });
}
