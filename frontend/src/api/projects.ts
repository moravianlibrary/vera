// Calls the projects endpoints; what they take and answer is in @vera/contract/projects.

import type {
  DecisionDryRun,
  ProjectApproval,
  ProjectChange,
  ProjectDetail,
  ProjectDraft,
  ProjectIndex,
  ProjectMembers,
  ProjectQuery,
  ProjectRejection,
} from "@vera/contract/projects";
import {
  decisionDryRunSchema,
  projectChangeSchema,
  projectDetailSchema,
  projectIndexSchema,
  toProjectSearchParams,
} from "@vera/contract/projects";
import { apiRoutes, projectRoute } from "@vera/contract/routes";
import { deleteResource, findJson, getJson, postJson, putJson } from "@/api/http";

// ---------------------------------------------------------------- calls

export async function listProjectIndex(query: ProjectQuery = {}): Promise<ProjectIndex> {
  return getJson(apiRoutes.projectIndex, projectIndexSchema, toProjectSearchParams(query));
}

// Null when it does not exist or the caller may not see it.
export async function findProject(projectId: string): Promise<ProjectDetail | null> {
  return findJson(projectRoute(projectId), projectDetailSchema);
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
