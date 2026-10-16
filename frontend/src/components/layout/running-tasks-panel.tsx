// The sidebar's *Running tasks* (navigation.md §6): a small panel at the foot with each run the
// person sees going and its progress, since a bar says whether to wait thirty seconds or go and
// do something else. Absent while nothing runs. On the rail it is one filled dot with the count.
// It reads what Tasks reads, in the same reach: everything for `task.read`, else the person's own.
// TODO(rrandiak): labels move to i18n.

import type { Session } from "@vera/domain/entities";
import { hasAnyPermission } from "@vera/domain/permissions";
import { Link } from "react-router";
import { percentOf, RunProgress } from "@/components/visualizations/run-progress";
import { useRunningRunsQuery } from "@/hooks/use-running-runs-query";

interface RunningTasksPanelProps {
  session: Session | undefined;
  isShowingLabels: boolean;
  onNavigate?: () => void;
}

export function RunningTasksPanel({
  session,
  isShowingLabels,
  onNavigate,
}: RunningTasksPanelProps) {
  const canReadRuns =
    session !== undefined && hasAnyPermission(session, ["task.read_own", "task.read"]);
  const { data } = useRunningRunsQuery({ isEnabled: canReadRuns });
  const runs = data?.runs ?? [];

  if (!canReadRuns || runs.length === 0) {
    return null;
  }

  const countText = `${runs.length} ${runs.length === 1 ? "task" : "tasks"} running`;

  if (!isShowingLabels) {
    return (
      <Link
        to="/tasks"
        onClick={onNavigate}
        title={countText}
        aria-label={countText}
        className="mb-2 flex h-9 items-center justify-center rounded-md hover:bg-sidebar-accent"
      >
        <span className="grid size-5 place-items-center rounded-full bg-chart-3 text-[0.625rem] font-bold text-white tabular-nums">
          {runs.length}
        </span>
      </Link>
    );
  }

  return (
    <section aria-label="Tasks running" className="mb-3 min-w-0 px-1.5">
      <Link
        to="/tasks"
        onClick={onNavigate}
        className="flex items-center justify-between text-xs font-medium text-sidebar-accent-foreground hover:underline"
      >
        Tasks running
        <span className="tabular-nums">{runs.length}</span>
      </Link>
      <ul className="mt-2 grid gap-2">
        {runs.map((run) => (
          <li key={run.id} className="min-w-0">
            <Link
              to={`/tasks?run=${encodeURIComponent(run.id)}`}
              onClick={onNavigate}
              className="group grid min-w-0 gap-1"
              title={run.what}
            >
              <span className="flex min-w-0 items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate group-hover:text-sidebar-accent-foreground">
                  {run.what}
                </span>
                <span className="shrink-0 tabular-nums">
                  {percentOf(run.doneCount, run.itemCount)}%
                </span>
              </span>
              <RunProgress
                done={run.doneCount}
                total={run.itemCount}
                errors={run.errorCount}
                form="sidebar"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
