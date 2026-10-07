// The runs in the caller's reach, one run with its items and log, and what is running for the
// sidebar's panel. While something runs they are asked again every few seconds, since progress
// is the whole message (navigation.md §6); once nothing runs they stop asking. Cancelling or
// running something again changes all three, and Schedules' last runs.

import { skipToken, useQuery } from "@tanstack/react-query";
import type { RunQuery } from "@/api/tasks";
import { getRun, listRunningRuns, listRuns } from "@/api/tasks";

export const tasksQueryKey = ["tasks"] as const;
export const schedulesQueryKey = ["schedules"] as const;

// What a run's acts, and a schedule's Run now, change.
export const taskInvalidations = [tasksQueryKey, schedulesQueryKey] as const;

const runningInterval = 5_000;
// The panel still looks now and then, for a run started somewhere else.
const idleInterval = 60_000;

export function useRunsQuery(query: RunQuery) {
  return useQuery({
    queryKey: [...tasksQueryKey, "list", query],
    queryFn: () => listRuns(query),
    refetchInterval: (current) =>
      (current.state.data?.tiles.runningCount ?? 0) > 0 ? runningInterval : false,
  });
}

export function useRunQuery(runId: string | null) {
  return useQuery({
    queryKey: [...tasksQueryKey, "detail", runId],
    queryFn: runId === null ? skipToken : () => getRun(runId),
    refetchInterval: (current) =>
      current.state.data?.run.state === "Running" ? runningInterval : false,
  });
}

// Only for someone who may read runs; the panel is absent while nothing runs.
export function useRunningRunsQuery({ isEnabled }: { isEnabled: boolean }) {
  return useQuery({
    queryKey: [...tasksQueryKey, "running"],
    queryFn: isEnabled ? listRunningRuns : skipToken,
    refetchInterval: (current) =>
      (current.state.data?.runs.length ?? 0) > 0 ? runningInterval : idleInterval,
  });
}
