// A task is one run of a plugin instance, or of a core job such as an intention repeat making its
// next occurrence (plugins.md §2.4; STATUS "Tasks"). What started it is its trigger; who it
// belongs to is who started it, and `task.read_own` reaches exactly those. Runs are never deleted
// by hand: they expire under a retention setting, since they are the record of what changed the
// data.

import type { GrantHolder } from "./permissions";
import { hasPermission } from "./permissions";

// Skipped is a scheduled run that found the previous one still going, on a schedule set to skip.
export const runStates = [
  "Running",
  "Done",
  "DoneWithErrors",
  "Failed",
  "Cancelled",
  "Skipped",
] as const;
export type RunState = (typeof runStates)[number];

// The states a run ends in: what the finished table filters by.
export const finishedRunStates = runStates.filter(
  (state): state is Exclude<RunState, "Running"> => state !== "Running",
);
export type FinishedRunState = (typeof finishedRunStates)[number];

// A person from the page they did it on; ingest on approval, never started by hand.
export const triggerKinds = ["schedule", "approval", "manual", "repeat"] as const;
export type TriggerKind = (typeof triggerKinds)[number];

// The session, or as much of it as a run's acts read.
export type RunHolder = GrantHolder & { readonly user: { readonly id: string } };

interface RunReach {
  readonly state: RunState;
  // Null: VERA itself, on a schedule or a repeat.
  readonly startedBy: string | null;
  readonly isRerunnable: boolean;
}

export function isOwnRun(session: RunHolder, run: Pick<RunReach, "startedBy">): boolean {
  return run.startedBy === session.user.id;
}

// Whoever started a run may cancel it (task.read_own); anyone else needs task.cancel.
export function canCancelRun(session: RunHolder, run: RunReach): boolean {
  return (
    run.state === "Running" && (isOwnRun(session, run) || hasPermission(session, "task.cancel"))
  );
}

// A failed or cancelled plugin run, by whoever started it or by someone who may run plugins.
export function canRunAgain(session: RunHolder, run: RunReach): boolean {
  return (
    run.isRerunnable &&
    (run.state === "Failed" || run.state === "Cancelled") &&
    (isOwnRun(session, run) || hasPermission(session, "plugin.run"))
  );
}
