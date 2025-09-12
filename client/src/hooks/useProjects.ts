import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { EsQuery, EsRequest } from "../models/es";
import type {
    EsProjectResponse,
    Project,
    ProjectEdit,
} from "../models/project";
import { projectApi } from "../services/api/project";
import type {
    AssignmentChange,
    BatchParams,
    Id,
    Priority,
} from "../models/common";
import type { ProposalCreate } from "../models/proposal";
import type {
    AdditionCreate,
    AdditionsSettingsParams,
} from "../models/addition";
import type { WatchlistSummary } from "../models/watchlist";

// -------------------------
// Queries
// -------------------------

export const useSearchProjects = (request: EsRequest, enabled = true) =>
    useQuery<EsProjectResponse>({
        queryKey: ["projects", "search", request],
        queryFn: () => projectApi.search(request),
        enabled,
    });

// -------------------------
// Mutations
// -------------------------

export const useCreateProject = () => {
    const queryClient = useQueryClient();
    return useMutation<Project, Error, ProjectEdit>({
        mutationFn: (projectProps) => projectApi.create(projectProps),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: ["projects", "search"] }),
    });
};

export const useUpdateProject = () => {
    const queryClient = useQueryClient();
    return useMutation<
        Project,
        Error,
        { projectId: Id; projectProps: ProjectEdit }
    >({
        mutationFn: ({ projectId, projectProps }) =>
            projectApi.update(projectId, projectProps),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: ["projects", "search"] }),
    });
};

export const useDeleteProject = () => {
    const queryClient = useQueryClient();
    return useMutation<Project, Error, Id>({
        mutationFn: (projectId) => projectApi.delete(projectId),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: ["projects", "search"] }),
    });
};

export const useChangeAssignment = () => {
    const queryClient = useQueryClient();
    return useMutation<
        Project,
        Error,
        { projectId: Id; assignment: AssignmentChange }
    >({
        mutationFn: ({ projectId, assignment }) =>
            projectApi.changeAssignment(projectId, assignment),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: ["projects", "search"] }),
    });
};

export const useProposeDocuments = () =>
    useMutation<
        unknown,
        Error,
        { projectId: Id; proposals: ProposalCreate[]; batchParams: BatchParams }
    >({
        mutationFn: ({ projectId, proposals, batchParams }) =>
            projectApi.proposeDocuments(projectId, proposals, batchParams),
    });

export const useAddDocuments = () =>
    useMutation<
        unknown,
        Error,
        {
            projectId: Id;
            additions: AdditionCreate[];
            settingsParams: AdditionsSettingsParams;
            batchParams: BatchParams;
        }
    >({
        mutationFn: ({ projectId, additions, settingsParams, batchParams }) =>
            projectApi.addDocuments(
                projectId,
                additions,
                settingsParams,
                batchParams
            ),
    });

export const useChangePriority = () =>
    useMutation<Project, Error, { projectId: Id; priority: Priority }>({
        mutationFn: ({ projectId, priority }) =>
            projectApi.changePriority(projectId, priority),
    });

export const useApproveProject = () =>
    useMutation<Project, Error, { projectId: Id; message?: string }>({
        mutationFn: ({ projectId, message }) =>
            projectApi.approve(projectId, message),
    });

export const useRejectProject = () =>
    useMutation<Project, Error, { projectId: Id; message?: string }>({
        mutationFn: ({ projectId, message }) =>
            projectApi.reject(projectId, message),
    });

export const useCreateWatchlist = () =>
    useMutation<
        WatchlistSummary,
        Error,
        { query: EsQuery; name: string; description?: string }
    >({
        mutationFn: ({ query, name, description }) =>
            projectApi.createWatchlist(query, name, description),
    });
