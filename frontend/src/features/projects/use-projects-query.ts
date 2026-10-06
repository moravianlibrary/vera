// The projects the caller sees with their numbers, and one project with what it funded. A
// project's acts change what Proposals and Documents show of its asks, and the reference list
// the propose form offers, so they refetch those too.

import { skipToken, useQuery } from "@tanstack/react-query";
import { findProject, listMemberGroups, listProjectIndex } from "@/api/projects";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { proposalsQueryKey } from "@/features/proposals/use-proposals-query";
import { referenceQueryKey } from "@/hooks/use-reference-query";

export const projectsQueryKey = ["projects"] as const;

export function useProjectIndexQuery() {
  return useQuery({ queryKey: [...projectsQueryKey, "index"], queryFn: listProjectIndex });
}

export function useProjectQuery(projectId: string | null) {
  return useQuery({
    queryKey: [...projectsQueryKey, "detail", projectId],
    queryFn: projectId === null ? skipToken : () => findProject(projectId),
  });
}

export function useMemberGroupsQuery(isEnabled: boolean) {
  return useQuery({
    queryKey: [...projectsQueryKey, "groups"],
    queryFn: isEnabled ? listMemberGroups : skipToken,
  });
}

// What a project's act changes.
export const projectInvalidations = [
  projectsQueryKey,
  proposalsQueryKey,
  documentsQueryKey,
  referenceQueryKey,
];
