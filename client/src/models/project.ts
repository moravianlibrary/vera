import { z } from "zod";
import { GroupSummarySchema } from "./group";
import { UserSummarySchema } from "./user";
import { WatchlistSummarySchema } from "./watchlist";
import { PrioritySchema } from "./common";
import { createEsResponseSchema } from "./api/responses/es";

const ProjectEditSchema = z.object({
    name: z.string(),
    description: z.string().optional().nullable(),
    target_page_count: z.number().optional().nullable(),
    start_date: z.date().optional().nullable(),
    end_date: z.date().optional().nullable(),
});
type ProjectEdit = z.infer<typeof ProjectEditSchema>;

const ProjectStatusSchema = z.enum(["Proposed", "Approved", "Rejected"]);
type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

const ProjectStatusLogEntrySchema = z.object({
    status: ProjectStatusSchema,
    message: z.string().optional(),
    updated_by: z.string(),
    updated_at: z.string().transform((s) => new Date(s)),
});
type ProjectStatusLogEntry = z.infer<typeof ProjectStatusLogEntrySchema>;

const ProjectSchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().optional(),

    target_page_count: z.number().optional(),
    start_date: z
        .string()
        .optional()
        .transform((s) => (s ? new Date(s) : undefined)),
    end_date: z
        .string()
        .optional()
        .transform((s) => (s ? new Date(s) : undefined)),

    created_by: z.string(),
    created_at: z.string().transform((s) => new Date(s)),

    priority: PrioritySchema,
    status: ProjectStatusSchema,
    is_archived: z.boolean(),

    groups: z.array(GroupSummarySchema),
    users: z.array(UserSummarySchema),

    status_log: z.array(ProjectStatusLogEntrySchema),

    watchlists: z.array(WatchlistSummarySchema),
});
type Project = z.infer<typeof ProjectSchema>;

const PartialProjectSchema = ProjectSchema.partial();
type PartialProject = z.infer<typeof PartialProjectSchema>;

const EsProjectResponseSchema = createEsResponseSchema(PartialProjectSchema);
type EsProjectResponse = z.infer<typeof EsProjectResponseSchema>;

export {
    ProjectEditSchema,
    ProjectSchema,
    PartialProjectSchema,
    EsProjectResponseSchema,
};
export type {
    ProjectEdit,
    Project,
    PartialProject,
    ProjectStatus,
    ProjectStatusLogEntry,
    EsProjectResponse,
};
