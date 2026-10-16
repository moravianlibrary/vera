// What may be done to an iteration, by its state rather than by who asks: the server refuses the
// rest, and the Documents and Validations panes leave it out. Who may is a grant's scope against the iteration's
// category path (permissions.md §2), which `scopeOfIteration` gives `can()`.

import { categoryLineageOf } from "./categories";
import type { Category, Iteration, Progress } from "./entities";
import type { ScopedRecord } from "./permissions";
import { isProgressAtLeast, isRestricted, validationOf } from "./status";

// Category and priority change until the scan exists (flows.md V13).
export function isReclassifiable(iteration: Iteration): boolean {
  return !isProgressAtLeast(iteration.progress, "Digitized");
}

// Only a scan can be somewhere to read; setting the link is what makes it Published (P1).
export function isPublishable(iteration: Iteration): boolean {
  return isProgressAtLeast(iteration.progress, "Digitized");
}

// Held at the gate rather than moved, and only before the scan exists (status-model.md §2.5).
export function isCancellable(iteration: Iteration): boolean {
  return iteration.cancellation === null && !isProgressAtLeast(iteration.progress, "Digitized");
}

// A hold is lifted only before the scan exists (ACT-resume).
export function isResumable(iteration: Iteration): boolean {
  return iteration.cancellation !== null && !isProgressAtLeast(iteration.progress, "Digitized");
}

// A restriction stands until a recheck no longer finds it or an administrator overrules it
// (ACT-overrule).
export function isOverrulable(iteration: Iteration): boolean {
  return isRestricted(iteration);
}

// Where a verdict or a fix leaves progress: Ready only while the restriction and validation gates
// pass, back to Enqueued when one fails after Ready, and returning when it clears (flows.md V14).
// A cancellation holds an item where it is rather than moving it; an item on a list stays there,
// flagged; nothing moves a scan back.
export function progressAfterGates(iteration: Iteration): Progress {
  const validation = validationOf(iteration);
  const isClear =
    !isRestricted(iteration) && (validation === "NotRequired" || validation === "Approved");
  if (iteration.progress === "Enqueued" && isClear && iteration.cancellation === null) {
    return "Ready";
  }

  if (iteration.progress === "Ready" && !isClear) {
    return "Enqueued";
  }

  return iteration.progress;
}

export function scopeOfIteration(
  categories: readonly Category[],
  categoryId: string,
): Extract<ScopedRecord, { kind: "iteration" }> {
  return { kind: "iteration", categoryPathIds: categoryLineageOf(categories, categoryId) };
}
