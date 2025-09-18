import { z } from "zod";
import { CronExpressionSchema, IdSchema, NameSchema } from "./common";
import { EsQuerySchema } from "./es";

const TaskStateSchema = z.enum([
    "Initializing",
    "Planned",
    "Canceled",
    "Running",
    "Skipped",
    "Finished",
    "Failed",
    "Killed",
]);
type TaskState = z.infer<typeof TaskStateSchema>;

const AdditionTaskSchema = z.enum(["Ingest", "Reingest", "Delete"]);
type AdditionTask = z.infer<typeof AdditionTaskSchema>;

const CatalogRecordTaskSchema = z.enum([
    "Reindex",
    "Sync",
    "SetForcedValidity",
    "MarkInReview",
    "ArchiveInactive",
    "Delete",
]);
type CatalogRecordTask = z.infer<typeof CatalogRecordTaskSchema>;

const CategoryTaskSchema = z.enum(["Reindex", "DocumentDiscovery"]);
type CategoryTask = z.infer<typeof CategoryTaskSchema>;

const DigitizationListTaskSchema = z.enum([
    "Create",
    "ChangeState",
    "AddDocuments",
    "RemoveDocuments",
    "Delete",
]);
type DigitizationListTask = z.infer<typeof DigitizationListTaskSchema>;

const DocumentTaskSchema = z.enum([
    "GenerateList",
    "SetCategory",
    "SetPriority",
    "SetDigitizationDecision",
    "Reindex",
    "Sync",
    "Delete",
]);
type DocumentTask = z.infer<typeof DocumentTaskSchema>;

const ProposalTaskSchema = z.enum([
    "Ingest",
    "Reingest",
    "Approve",
    "Reject",
    "Delete",
]);
type ProposalTask = z.infer<typeof ProposalTaskSchema>;

const SystemTaskSchema = z.enum([
    "RecreateIndex",
    "ResolveInconsistencies",
    "WatchlistChange",
]);
type SystemTask = z.infer<typeof SystemTaskSchema>;

const UnscopedTaskTypeSchema = z.union([
    AdditionTaskSchema,
    CatalogRecordTaskSchema,
    CategoryTaskSchema,
    DigitizationListTaskSchema,
    DocumentTaskSchema,
    ProposalTaskSchema,
    SystemTaskSchema,
]);
type UnscopedTaskType = z.infer<typeof UnscopedTaskTypeSchema>;

const TaskScopeSchema = z.enum([
    "Addition",
    "CatalogRecord",
    "Category",
    "DigitizationList",
    "Document",
    "Proposal",
    "System",
]);
type TaskScope = z.infer<typeof TaskScopeSchema>;

const ScopedTaskTypeSchema = z.enum([
    "Addition.Ingest",
    "Addition.Reingest",
    "Addition.Delete",

    "CatalogRecord.Reindex",
    "CatalogRecord.Sync",
    "CatalogRecord.SetForcedValidity",
    "CatalogRecord.MarkInReview",
    "CatalogRecord.ArchiveInactive",
    "CatalogRecord.Delete",

    "Category.Reindex",
    "Category.DocumentDiscovery",

    "DigitizationList.Create",
    "DigitizationList.ChangeState",
    "DigitizationList.AddDocuments",
    "DigitizationList.RemoveDocuments",
    "DigitizationList.Delete",

    "Document.GenerateList",
    "Document.SetCategory",
    "Document.SetPriority",
    "Document.SetDigitizationDecision",
    "Document.Reindex",
    "Document.Sync",
    "Document.Delete",

    "Proposal.Ingest",
    "Proposal.Reingest",
    "Proposal.Approve",
    "Proposal.Reject",
    "Proposal.Delete",

    "System.RecreateIndex",
    "System.ResolveInconsistencies",
    "System.WatchlistChange",
]);
type ScopedTaskType = z.infer<typeof ScopedTaskTypeSchema>;

const TaskSchema = z.object({
    id: IdSchema,
    task_type: ScopedTaskTypeSchema,
    task_scope: TaskScopeSchema,
    unscoped_task_type: UnscopedTaskTypeSchema,
    name: z.string(),

    task_schedule_id: IdSchema.optional().nullable(),
    created_by: z.string(),

    has_query: z.boolean(),
    has_data: z.boolean(),

    task_state: TaskStateSchema,

    created_at: z.string().transform((s) => new Date(s)),
    started_at: z
        .string()
        .transform((s) => new Date(s))
        .optional()
        .nullable(),
    finished_at: z
        .string()
        .transform((s) => new Date(s))
        .optional()
        .nullable(),

    progress: z.number().min(0).max(1),
    processed_count: z.number().int().min(0),
    total_count: z.number().int().min(0),

    result: z.any().optional().nullable(),
});
type Task = z.infer<typeof TaskSchema>;

const ScheduleTaskParamsSchema = z.object({
    schedule_name: NameSchema,
    cron_expression: CronExpressionSchema,
});
type ScheduleTaskParams = z.infer<typeof ScheduleTaskParamsSchema>;

const TaskScheduleSchema = z.object({
    id: IdSchema,
    name: NameSchema,
    cron_expression: CronExpressionSchema,

    task_type: ScopedTaskTypeSchema,
    query: EsQuerySchema.optional().nullable(),
    data: z.any().optional().nullable(),

    task_scope: TaskScopeSchema,
    unscoped_task_type: UnscopedTaskTypeSchema,
});
type TaskSchedule = z.infer<typeof TaskScheduleSchema>;

const TaskOrScheduleSchema = z.union([TaskSchema, TaskScheduleSchema]);
type TaskOrSchedule = z.infer<typeof TaskOrScheduleSchema>;

export {
    TaskStateSchema,
    AdditionTaskSchema,
    CatalogRecordTaskSchema,
    CategoryTaskSchema,
    DigitizationListTaskSchema,
    DocumentTaskSchema,
    ProposalTaskSchema,
    SystemTaskSchema,
    UnscopedTaskTypeSchema,
    TaskScopeSchema,
    ScopedTaskTypeSchema,
    TaskSchema,
    ScheduleTaskParamsSchema,
    TaskScheduleSchema,
    TaskOrScheduleSchema,
};
export type {
    TaskState,
    AdditionTask,
    CatalogRecordTask,
    CategoryTask,
    DigitizationListTask,
    DocumentTask,
    ProposalTask,
    SystemTask,
    UnscopedTaskType,
    TaskScope,
    ScopedTaskType,
    Task,
    ScheduleTaskParams,
    TaskSchedule,
    TaskOrSchedule,
};
