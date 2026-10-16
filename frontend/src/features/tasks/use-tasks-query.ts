// The runs in the caller's reach, one run with its items and log, and the schedules over a
// window. While something runs they
// are asked again every few seconds, since progress is the whole message (navigation.md §6); once
// nothing runs they stop asking. Cancelling or running something again changes both, the
// sidebar's panel and Schedules' last runs.

import { skipToken, useQuery } from "@tanstack/react-query";
import type { TimelineRange } from "@vera/contract/schedules";
import type { RunQuery } from "@vera/contract/tasks";
import { listSchedules } from "@/api/schedules";
import { getRun, listRuns } from "@/api/tasks";
import { runningInterval, tasksQueryKey } from "@/hooks/use-running-runs-query";

export const schedulesQueryKey = ["schedules"] as const;

// What a run's acts, and a schedule's Run now, change.
export const taskInvalidations = [tasksQueryKey, schedulesQueryKey] as const;

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

// Their next runs move on with the clock, so they are asked again each minute.
export function useSchedulesQuery(range: TimelineRange) {
  return useQuery({
    queryKey: [...schedulesQueryKey, range],
    queryFn: () => listSchedules(range),
    refetchInterval: 60_000,
  });
}
