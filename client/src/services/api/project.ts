import type {
    AdditionCreate,
    AdditionsSettingsParams,
} from "../../models/addition";
import type {
    AssignmentChange,
    BatchParams,
    Id,
    Priority,
} from "../../models/common";
import type { EsQuery, EsRequest } from "../../models/es";
import { EsProjectResponseSchema } from "../../models/project";
import type {
    Project,
    EsProjectResponse,
    ProjectEdit,
} from "../../models/project";
import type { ProposalCreate } from "../../models/proposal";
import type { WatchlistSummary } from "../../models/watchlist";
import api from "./base";

// -------------------------
// Project API
// -------------------------

const search = async (request: EsRequest): Promise<EsProjectResponse> =>
    EsProjectResponseSchema.parse(
        (await api.post("/projects/search", request)).data
    );

const create = async (project_props: ProjectEdit) =>
    (await api.post<Project>("/projects", project_props)).data;

const update = async (project_id: Id, project_props: ProjectEdit) =>
    (await api.put<Project>(`/projects/${project_id}`, project_props)).data;

const delete_ = async (project_id: Id) =>
    (await api.delete<Project>(`/projects/${project_id}`)).data;

const changeAssignment = async (
    project_id: Id,
    assignment_change: AssignmentChange
) =>
    (
        await api.patch<Project>(
            `/projects/${project_id}/assignment`,
            assignment_change
        )
    ).data;

const proposeDocuments = async (
    project_id: Id,
    proposals: ProposalCreate[],
    batch_params: BatchParams
) =>
    (
        await api.post(`/projects/${project_id}/propose-documents`, proposals, {
            params: batch_params,
        })
    ).data;

const addDocuments = async (
    project_id: Id,
    additions: AdditionCreate[],
    settings_params: AdditionsSettingsParams,
    batch_params: BatchParams
) =>
    (
        await api.post(`/projects/${project_id}/add-documents`, additions, {
            params: { ...batch_params, ...settings_params },
        })
    ).data;

const changePriority = async (project_id: Id, priority: Priority) =>
    (await api.patch<Project>(`/projects/${project_id}/priority`, { priority }))
        .data;

const approve = async (project_id: Id, message?: string) =>
    (
        await api.patch<Project>(
            `/projects/${project_id}/approve`,
            message ? { message } : null
        )
    ).data;

const reject = async (project_id: Id, message?: string) =>
    (
        await api.patch<Project>(
            `/projects/${project_id}/reject`,
            message ? { message } : null
        )
    ).data;

const createWatchlist = async (
    query: EsQuery,
    name: string,
    description?: string
) =>
    (
        await api.post<WatchlistSummary>("/projects/watchlist", query, {
            params: { name, description },
        })
    ).data;

// -------------------------
// Export
// -------------------------

export const projectApi = {
    search,
    create,
    update,
    delete: delete_,
    changeAssignment,
    proposeDocuments,
    addDocuments,
    changePriority,
    approve,
    reject,
    createWatchlist,
};
