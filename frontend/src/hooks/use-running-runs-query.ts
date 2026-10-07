// What is running in the caller's reach, for the sidebar's panel (navigation.md §6), and the key
// every runs query shares, so an act on a run refreshes the panel with the page. While something
// runs it asks again every few seconds, since progress is the whole message; otherwise now and
// then, for a run started somewhere else.

import { skipToken, useQuery } from "@tanstack/react-query";
import { listRunningRuns } from "@/api/tasks";

export const tasksQueryKey = ["tasks"] as const;

export const runningInterval = 5_000;
const idleInterval = 60_000;

// Only for someone who may read runs; the panel is absent while nothing runs.
export function useRunningRunsQuery({ isEnabled }: { isEnabled: boolean }) {
  return useQuery({
    queryKey: [...tasksQueryKey, "running"],
    queryFn: isEnabled ? listRunningRuns : skipToken,
    refetchInterval: (current) =>
      (current.state.data?.runs.length ?? 0) > 0 ? runningInterval : idleInterval,
  });
}
