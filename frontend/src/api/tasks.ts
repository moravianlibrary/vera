// Calls the tasks endpoints; what they take and answer is in @vera/contract/tasks.

import { apiRoutes, taskActionRoute, taskRoute } from "@vera/contract/routes";
import type {
  Retention,
  Run,
  RunDetail,
  RunIndex,
  RunningRuns,
  RunQuery,
} from "@vera/contract/tasks";
import {
  retentionSchema,
  runDetailSchema,
  runIndexSchema,
  runningRunsSchema,
  runSchema,
  toRunSearchParams,
} from "@vera/contract/tasks";
import { ApiError, getJson, postJson, putJson } from "@/api/http";
import { env } from "@/config/env";

// ---------------------------------------------------------------- calls

export async function listRuns(query: RunQuery): Promise<RunIndex> {
  return getJson(apiRoutes.tasks, runIndexSchema, toRunSearchParams(query));
}

export async function getRun(runId: string): Promise<RunDetail> {
  return getJson(taskRoute(runId), runDetailSchema);
}

export async function listRunningRuns(): Promise<RunningRuns> {
  return getJson(apiRoutes.runningTasks, runningRunsSchema);
}

// It stops after the item it is on; what it already changed stays.
export async function cancelRun(runId: string): Promise<Run> {
  return postJson(taskActionRoute(runId, "cancel"), {}, runSchema);
}

// A new run of the same instance; the old one stays as it was.
export async function runAgain(runId: string): Promise<Run> {
  return postJson(taskActionRoute(runId, "rerun"), {}, runSchema);
}

export async function saveRetention(retention: Retention): Promise<Retention> {
  return putJson(apiRoutes.taskRetention, retention, retentionSchema);
}

// The log as plain text, to save as a file.
export async function getRunLog(runId: string): Promise<string> {
  const path = taskActionRoute(runId, "log");
  const response = await fetch(new URL(`${env.VITE_API_BASE_URL}${path}`, window.location.origin));
  if (!response.ok) {
    throw new ApiError(response.status, path, `GET ${path} failed: HTTP ${response.status}`);
  }

  return response.text();
}
