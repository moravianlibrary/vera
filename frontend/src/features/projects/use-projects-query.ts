// The projects the caller sees with their numbers, and one project with what it funded. A
// project's acts change what Proposals and Documents show of its asks, and the reference list
// the propose form offers, so they refetch those too.

import { skipToken, useQuery } from "@tanstack/react-query";
import type { ProjectQuery } from "@/api/projects";
import { findProject, listProjectIndex } from "@/api/projects";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { proposalsQueryKey } from "@/features/proposals/use-proposals-query";
import { referenceQueryKey } from "@/hooks/use-reference-query";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";

export const projectsQueryKey = ["projects"] as const;

export function useProjectIndexQuery(query: ProjectQuery = {}) {
  return useQuery({
    queryKey: [...projectsQueryKey, "index", query],
    queryFn: () => listProjectIndex(query),
  });
}

export function useProjectQuery(projectId: string | null) {
  return useQuery({
    queryKey: [...projectsQueryKey, "detail", projectId],
    queryFn: projectId === null ? skipToken : () => findProject(projectId),
  });
}

// What a project's act changes.
export const projectInvalidations = [
  projectsQueryKey,
  proposalsQueryKey,
  documentsQueryKey,
  referenceQueryKey,
  watchlistsQueryKey,
];
