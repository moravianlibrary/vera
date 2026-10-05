// Reference data views resolve names through. It changes rarely, so it is fetched once per visit.

import { useQuery } from "@tanstack/react-query";
import { listCategories, listProjects, listUsers } from "@/api/reference";

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
