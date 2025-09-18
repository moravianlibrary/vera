import type { Id, Priority } from "../../models/common";
import { EsDocumentResponseSchema } from "../../models/document";
import type {
    DigitizationDecision,
    EsDocumentResponse,
    ExportDocumentsParams,
    GenerateDocumentListParams,
    PageCount,
    SyncDocumentsParams,
} from "../../models/document";
import type { EsQuery, EsRequest } from "../../models/es";
import type {
    TaskOrSchedule,
    ScheduleTaskParams,
    Task,
} from "../../models/task";
import type { WatchlistSummary } from "../../models/watchlist";
import api from "./base";

// -------------------------
// Document API
// -------------------------
const search = async (request: EsRequest): Promise<EsDocumentResponse> =>
    EsDocumentResponseSchema.parse(
        (await api.post("/documents/search", request)).data
    );

const export_ = async (query: EsQuery, params: ExportDocumentsParams) =>
    (
        await api.post("/documents/export", query, {
            params,
            responseType: "blob",
        })
    ).data;

const generateList = async (
    query: EsQuery,
    params: GenerateDocumentListParams
) => (await api.post<Task>(`/documents/generate-list`, query, { params })).data;

const updatePageCount = async (document_id: Id, page_count: PageCount) =>
    (
        await api.patch(`/documents/${document_id}/page-count`, null, {
            params: { page_count },
        })
    ).data;

const setCategory = async (query: EsQuery, category_id: Id) =>
    (
        await api.patch<Task>(`/documents/category`, query, {
            params: { category_id },
        })
    ).data;

const setPriority = async (query: EsQuery, priority: Priority) =>
    (
        await api.patch<Task>(`/documents/priority`, query, {
            params: { priority },
        })
    ).data;

const setDigitizationDecision = async (
    query: EsQuery,
    decision: DigitizationDecision
) =>
    (
        await api.patch<Task>(`/documents/digitization-decision`, query, {
            params: { decision },
        })
    ).data;

const reindex = async (query: EsQuery, schedule_params: ScheduleTaskParams) =>
    (
        await api.post<TaskOrSchedule>(`/documents/reindex`, query, {
            params: schedule_params,
        })
    ).data;

const sync = async (
    query: EsQuery,
    sync_params: SyncDocumentsParams,
    schedule_params: ScheduleTaskParams
) =>
    (
        await api.post<TaskOrSchedule>(`/documents/sync`, query, {
            params: { ...sync_params, ...schedule_params },
        })
    ).data;

const delete_ = async (query: EsQuery) =>
    (await api.post<Task>(`/documents/delete`, { data: query })).data;

const createWatchlist = async (
    query: EsQuery,
    name: string,
    description?: string
) =>
    (
        await api.post<WatchlistSummary>("/documents/watchlist", query, {
            params: { name, description },
        })
    ).data;

// -------------------------
// Export
// -------------------------

export const documentApi = {
    search,
    export: export_,
    generateList,
    updatePageCount,
    setCategory,
    setPriority,
    setDigitizationDecision,
    reindex,
    sync,
    delete: delete_,
    createWatchlist,
};
