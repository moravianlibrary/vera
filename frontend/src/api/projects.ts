// The Projects resource (projects.md, flows.md PJ1–PJ6, D11, D12): every project the caller may
// see with its period, and its own intention's target, numbers and pace (§1.1), all worked out by
// the server; one project with its proposals, the lists carrying what it funded, the iterations it
// funded and its history; and what is done to one: start, edit (with what a change does to its
// intention's figures), members, approve, reject, delete. The bare `/projects` stays the
// reference data other views name a project by.

import { z } from "zod";
import { deleteResource, findJson, getJson, postJson, putJson } from "@/api/http";
import { apiRoutes, projectRoute } from "@/api/routes";
import {
  digitizationListSchema,
  documentSchema,
  iterationSchema,
  prioritySchema,
  projectSchema,
  statusLogEntrySchema,
} from "@/domain/entities";
import { targetVerdicts } from "@/domain/intentions";
import { listStateSchema } from "@/domain/lists";
import { projectPeriods } from "@/domain/projects";

const count = z.number().int().nonnegative();
const pages = z.number().int().nonnegative();

export const projectPeriodSchema = z.enum(projectPeriods);

// ---------------------------------------------------------------- index

// A group on a project: everyone in it is a member while they are in it.
export const memberGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  peopleCount: count,
});
export type MemberGroup = z.infer<typeof memberGroupSchema>;

// The intention made with the project (intentions.md §3.4): its name and window are the
// project's; the target is entered on the project form and stored on it.
export const projectIntentionSchema = z.object({
  id: z.string(),
  // None: it tracks the mix.
  targetPages: pages.nullable(),
});
export type ProjectIntention = z.infer<typeof projectIntentionSchema>;

// Planned and delivered are its intention's, counted over the project's period by the intention
// rules; they are never added (STATUS, *Planned counts only items on a list that still exists*).
export const projectRowSchema = z.object({
  project: projectSchema,
  intention: projectIntentionSchema,
  period: projectPeriodSchema,
  // 0 to 1, the share of the period gone by today.
  timeElapsed: z.number().min(0).max(1),
  // Today counts as left; both are 0 once past.
  daysToStart: count,
  daysLeft: count,
  // Where planned and delivered would be at an even pace; only while an Approved project with a
  // target runs.
  evenPace: z.number().min(0).max(1).nullable(),
  // Its intention's, only once the project is Approved.
  verdict: z.enum(targetVerdicts).nullable(),
  fundedCount: count,
  plannedPages: pages,
  deliveredPages: pages,
  // Approved and funded, not on a list yet.
  waiting: z.object({ itemCount: count, pages }),
  // What a decision would act on, one per document (flows.md D11).
  pending: z.object({ documentCount: count, withCopyCount: count }),
  // Any decision; a project with none can be deleted.
  proposalCount: count,
  listCount: count,
  memberGroups: z.array(memberGroupSchema),
});
export type ProjectRow = z.infer<typeof projectRowSchema>;

// Few projects run at once (STATUS "Projects"): the whole index, not a page of it.
export const projectIndexSchema = z.object({ rows: z.array(projectRowSchema) });
export type ProjectIndex = z.infer<typeof projectIndexSchema>;

// ---------------------------------------------------------------- detail

// One row per document, as on Proposals: one decision covers every asker.
export const projectProposalSchema = z.object({
  documentId: z.string(),
  title: z.string(),
  // Catalog ID, and the unit for one part of a larger record.
  identifier: z.string(),
  requesterId: z.string(),
  at: z.iso.datetime(),
  decision: z.enum(["Pending", "Approved", "Denied", "Withdrawn", "Duplicate"]),
  isAfterProjectApproval: z.boolean(),
  hasCopy: z.boolean(),
});
export type ProjectProposal = z.infer<typeof projectProposalSchema>;

// A list reaches a project only through the iterations it funds (relationships.md §4).
export const projectListSchema = z.object({
  list: digitizationListSchema,
  state: listStateSchema,
  itemCount: count,
  pages,
});
export type ProjectList = z.infer<typeof projectListSchema>;

export const fundedItemSchema = z.object({
  iteration: iterationSchema,
  document: documentSchema,
  pages: pages.nullable(),
  // The list it is on, or the name of the deleted one it was on.
  listName: z.string().nullable(),
});
export type FundedItem = z.infer<typeof fundedItemSchema>;

export const projectDetailSchema = z.object({
  row: projectRowSchema,
  proposals: z.array(projectProposalSchema),
  lists: z.array(projectListSchema),
  // A deleted list's items stop counting; its name is all that is left.
  formerLists: z.array(z.object({ name: z.string(), itemCount: count })),
  funded: z.array(fundedItemSchema),
  log: z.array(statusLogEntrySchema),
});
export type ProjectDetail = z.infer<typeof projectDetailSchema>;

// ---------------------------------------------------------------- acts

const calendarDate = z.iso.date();

// Start or edit (flows.md PJ1, PJ2). The manager and members are their own act.
export const projectDraftSchema = z
  .object({
    name: z.string().trim().min(1, "A project needs a name"),
    description: z.string().trim(),
    startsOn: calendarDate,
    endsOn: calendarDate,
    // Its intention's target; none, and the intention only tracks the mix.
    targetPages: z.number().int().positive().nullable(),
  })
  .refine((draft) => draft.endsOn >= draft.startsOn, {
    message: "It cannot end before it starts",
    path: ["endsOn"],
  });
export type ProjectDraft = z.infer<typeof projectDraftSchema>;

const beforeAfterSchema = z.object({ before: pages, after: pages });

// What an edit does to its intention's figures, said before saving: new dates move its window and
// recount it (intentions.md §3.4).
export const projectChangeSchema = z.object({
  plannedPages: beforeAfterSchema,
  deliveredPages: beforeAfterSchema,
});
export type ProjectChange = z.infer<typeof projectChangeSchema>;

// The whole set at once, the manager among the people (projects.md §3).
export const projectMembersSchema = z
  .object({
    managerId: z.string().min(1),
    memberIds: z.array(z.string().min(1)),
    memberGroupIds: z.array(z.string().min(1)),
  })
  .refine((members) => members.memberIds.includes(members.managerId), {
    message: "The manager is always a member",
    path: ["managerId"],
  });
export type ProjectMembers = z.infer<typeof projectMembersSchema>;

const decidedDocumentSchema = z.object({
  documentId: z.string(),
  title: z.string(),
  // Somebody outside the project asked for it too: rejecting leaves their ask Pending.
  isAskedByOthers: z.boolean(),
});
export type DecidedDocument = z.infer<typeof decidedDocumentSchema>;

// What a decision would do, said before it is made (flows.md D11, D12): approving takes the
// pending documents without a copy and skips those with one; rejecting declines the project's
// own asks.
export const decisionDryRunSchema = z.object({
  approves: z.array(decidedDocumentSchema),
  skips: z.array(decidedDocumentSchema),
  pending: z.array(decidedDocumentSchema),
});
export type DecisionDryRun = z.infer<typeof decisionDryRunSchema>;

export const projectApprovalSchema = z.object({ priority: prioritySchema });
export type ProjectApproval = z.infer<typeof projectApprovalSchema>;

export const projectRejectionSchema = z.object({
  reason: z.string().trim().min(1, "Say why: every member reads it"),
});
export type ProjectRejection = z.infer<typeof projectRejectionSchema>;

// ---------------------------------------------------------------- calls

export async function listProjectIndex(): Promise<ProjectIndex> {
  return getJson(apiRoutes.projectIndex, projectIndexSchema);
}

// Null when it does not exist or the caller may not see it.
export async function findProject(projectId: string): Promise<ProjectDetail | null> {
  return findJson(projectRoute(projectId), projectDetailSchema);
}

// The groups a project can take as members, for the Members dialog.
export async function listMemberGroups(): Promise<MemberGroup[]> {
  return getJson(apiRoutes.groups, z.array(memberGroupSchema));
}

export async function createProject(draft: ProjectDraft): Promise<ProjectDetail> {
  return postJson(apiRoutes.projects, draft, projectDetailSchema);
}

export async function saveProject(projectId: string, draft: ProjectDraft): Promise<ProjectDetail> {
  return putJson(projectRoute(projectId), draft, projectDetailSchema);
}

export async function previewProjectChange(
  projectId: string,
  draft: ProjectDraft,
): Promise<ProjectChange> {
  return postJson(`${projectRoute(projectId)}/preview`, draft, projectChangeSchema);
}

export async function saveProjectMembers(
  projectId: string,
  members: ProjectMembers,
): Promise<ProjectDetail> {
  return putJson(`${projectRoute(projectId)}/members`, members, projectDetailSchema);
}

export async function previewDecision(projectId: string): Promise<DecisionDryRun> {
  return getJson(`${projectRoute(projectId)}/decision`, decisionDryRunSchema);
}

export async function approveProject(
  projectId: string,
  approval: ProjectApproval,
): Promise<ProjectDetail> {
  return postJson(`${projectRoute(projectId)}/approve`, approval, projectDetailSchema);
}

export async function rejectProject(
  projectId: string,
  rejection: ProjectRejection,
): Promise<ProjectDetail> {
  return postJson(`${projectRoute(projectId)}/reject`, rejection, projectDetailSchema);
}

export async function deleteProject(projectId: string): Promise<void> {
  return deleteResource(projectRoute(projectId));
}
