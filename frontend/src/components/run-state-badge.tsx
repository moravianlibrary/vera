// A run's state as a badge (docs/demos/shared/page-tasks.js `RUN`): on Tasks and Schedules, and
// on Plugins for an instance's last and recent runs. Done with errors counts them.

import type { Run } from "@vera/contract/tasks";
import type { RunState } from "@vera/domain/tasks";
import { useTranslation } from "react-i18next";
import type { Tone } from "@/components/status-badge";
import { ToneBadge } from "@/components/status-badge";

export const runStateLabels = {
  Running: "common:runState.Running",
  Done: "common:runState.Done",
  DoneWithErrors: "common:runState.DoneWithErrors",
  Failed: "common:runState.Failed",
  Cancelled: "common:runState.Cancelled",
  Skipped: "common:runState.Skipped",
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
  const { t } = useTranslation("common");
  const label =
    run.state === "DoneWithErrors"
      ? t("runState.doneWithErrors", { count: run.errorCount })
      : t(`runState.${run.state}`);
  return <ToneBadge tone={runStateTones[run.state]}>{label}</ToneBadge>;
}
