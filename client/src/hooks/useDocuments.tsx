import { useMutation, useQuery } from "@tanstack/react-query";
import { documentApi } from "../services/api/document";
import type {
    DigitizationDecision,
    EsDocumentResponse,
    ExportDocumentsParams,
    GenerateDocumentListParams,
    PageCount,
    SyncDocumentsParams,
} from "../models/document";
import type { ScheduleTaskParams, Task, TaskOrSchedule } from "../models/task";
import type { Id, Priority } from "../models/common";
import type { WatchlistSummary } from "../models/watchlist";
import type { EsRequest } from "../models/api/requests/es";
import type { EsQuery } from "../models/api/requests/es_query";

// -------------------------
// Queries
// -------------------------
export const useSearchDocuments = (request: EsRequest, enabled = true) =>
    useQuery<EsDocumentResponse>({
        queryKey: ["documents", "search", request],
        queryFn: () => documentApi.search(request),
        enabled,
    });

// -------------------------
// Mutations
// -------------------------
export const useExportDocuments = () =>
    useMutation<Blob, Error, { query: EsQuery; params: ExportDocumentsParams }>(
        {
            mutationFn: ({ query, params }) =>
                documentApi.export(query, params),
        }
    );

export const useGenerateDocumentList = () =>
    useMutation<
        Task,
        Error,
        { query: EsQuery; params: GenerateDocumentListParams }
    >({
        mutationFn: ({ query, params }) =>
            documentApi.generateList(query, params),
    });

export const useUpdatePageCount = () =>
    useMutation<Task, Error, { documentId: Id; pageCount: PageCount }>({
        mutationFn: ({ documentId, pageCount }) =>
            documentApi.updatePageCount(documentId, pageCount),
    });

export const useSetCategory = () =>
    useMutation<Task, Error, { query: EsQuery; categoryId: Id }>({
        mutationFn: ({ query, categoryId }) =>
            documentApi.setCategory(query, categoryId),
    });

export const useSetPriority = () =>
    useMutation<Task, Error, { query: EsQuery; priority: Priority }>({
        mutationFn: ({ query, priority }) =>
            documentApi.setPriority(query, priority),
    });

export const useSetDigitizationDecision = () =>
    useMutation<
        Task,
        Error,
        { query: EsQuery; decision: DigitizationDecision }
    >({
        mutationFn: ({ query, decision }) =>
            documentApi.setDigitizationDecision(query, decision),
    });

export const useReindexDocuments = () =>
    useMutation<
        TaskOrSchedule,
        Error,
        { query: EsQuery; schedule: ScheduleTaskParams }
    >({
        mutationFn: ({ query, schedule }) =>
            documentApi.reindex(query, schedule),
    });

export const useSyncDocuments = () =>
    useMutation<
        TaskOrSchedule,
        Error,
        {
            query: EsQuery;
            sync: SyncDocumentsParams;
            schedule: ScheduleTaskParams;
        }
    >({
        mutationFn: ({ query, sync, schedule }) =>
            documentApi.sync(query, sync, schedule),
    });

export const useDeleteDocuments = () =>
    useMutation<Task, Error, { query: EsQuery }>({
        mutationFn: ({ query }) => documentApi.delete(query),
    });

export const useCreateWatchlistFromDocuments = () =>
    useMutation<
        WatchlistSummary,
        Error,
        { query: EsQuery; name: string; description?: string }
    >({
        mutationFn: ({ query, name, description }) =>
            documentApi.createWatchlist(query, name, description),
    });
