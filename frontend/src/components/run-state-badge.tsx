// A run's state as a badge (docs/demos/shared/page-tasks.js `RUN`): on Tasks and Schedules, and
// on Plugins for an instance's last and recent runs. Done with errors counts them.
// TODO(rrandiak): labels move to i18n.

import type { Run } from "@/api/tasks";
import type { Tone } from "@/components/status-badge";
import { ToneBadge } from "@/components/status-badge";
import type { RunState } from "@/domain/tasks";
import { plural } from "@/lib/plural";

export const runStateLabels = {
  Running: "Running",
  Done: "Done",
  DoneWithErrors: "Done with errors",
  Failed: "Failed",
  Cancelled: "Cancelled",
  Skipped: "Skipped",
} as const satisfies Record<RunState, string>;

export const runStateTones = {
  Running: "blue",
  Done: "green",
  DoneWithErrors: "amber",
  Failed: "red",
  Cancelled: "slate",
  Skipped: "slate",
} as const satisfies Record<RunState, Tone>;

export function RunStateBadge({ run }: { run: Pick<Run, "state" | "errorCount"> }) {
  const label =
    run.state === "DoneWithErrors"
      ? `Done · ${plural(run.errorCount, "error")}`
      : runStateLabels[run.state];
  return <ToneBadge tone={runStateTones[run.state]}>{label}</ToneBadge>;
}
