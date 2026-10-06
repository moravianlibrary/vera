// Status derivations over the four stored axes: decision, restriction, validation, progress.
// Pure functions only. Implements docs/design/shared/entities/status-model.md: validation from
// defects and verdicts (§2), the gates (§3), the displayed status by precedence (§4) and the
// coarser public vocabulary a requester reads (§5, view-map §4).

import type { Decision, Iteration, Progress, Request } from "@/domain/entities";
import { progressValues } from "@/domain/entities";

export const validations = ["Needed", "Denied", "Approved", "NotRequired"] as const;
export type Validation = (typeof validations)[number];

// The single badge per row. Keys are stable; labels come from i18n.
export const displayStatuses = [
  "Declined",
  "Withdrawn",
  "AwaitingReview",
  "BeingAdded",
  "Cancelled",
  "NotDigitizable",
  "Forbidden",
  "ValidationDenied",
  "ReviewNeeded",
  ...progressValues,
] as const;
export type DisplayStatus = (typeof displayStatuses)[number];

export type StatusFootnote = "ReviewNeeded" | "ValidationDenied";

// What a requester reads: coarser, it only says whether to wait (view-map.md §4).
export const publicStatuses = [
  "WaitingForReview",
  "NotAccepted",
  "Withdrawn",
  "BeingAdded",
  "BeingChecked",
  "WaitingToBeScheduled",
  "Scheduled",
  "Available",
  "OnHold",
  "NotAvailable",
] as const;
export type PublicStatus = (typeof publicStatuses)[number];

// ---------------------------------------------------------------- progress

export function isProgressAtLeast(progress: Progress, threshold: Progress): boolean {
  return progressValues.indexOf(progress) >= progressValues.indexOf(threshold);
}

// ---------------------------------------------------------------- validation

// Compares the current defect set D with approved keys A and denied keys N (status-model.md §2).
export function validationOf(iteration: Iteration): Validation {
  const defectKeys = iteration.defects.map((defect) => defect.key);
  if (defectKeys.length === 0) {
    return "NotRequired";
  }

  const deniedKeys = deniedKeysOf(iteration);
  if (defectKeys.some((key) => deniedKeys.has(key))) {
    return "Denied";
  }

  const approvedKeys = approvedKeysOf(iteration);
  return defectKeys.every((key) => approvedKeys.has(key)) ? "Approved" : "Needed";
}

// What a curator is shown: D \ A, never what was already accepted.
export function outstandingDefects(iteration: Iteration): Iteration["defects"] {
  const approvedKeys = approvedKeysOf(iteration);
  return iteration.defects.filter((defect) => !approvedKeys.has(defect.key));
}

// A: the keys accepted and not revoked since. The table is append-only, so the later row wins.
export function approvedKeysOf(iteration: Iteration): Set<string> {
  const approved = new Set<string>();
  for (const entry of iteration.verdicts) {
    for (const key of entry.defectKeys) {
      if (entry.verdict === "Approved") {
        approved.add(key);
      } else if (entry.verdict === "Revoked") {
        approved.delete(key);
      }
    }
  }

  return approved;
}

// N: the keys ruled substantial. A denial lapses only when its defect is gone (status-model §2).
export function deniedKeysOf(iteration: Iteration): Set<string> {
  return new Set(
    iteration.verdicts
      .filter((entry) => entry.verdict === "Denied")
      .flatMap((entry) => entry.defectKeys),
  );
}

// ---------------------------------------------------------------- gates

export function isRestricted(iteration: Iteration): boolean {
  return iteration.restriction !== null && iteration.restrictionOverride === null;
}

// Every iteration comes from an approved request, so the decision gate always holds here.
export function passesGates(iteration: Iteration): boolean {
  const validation = validationOf(iteration);
  return (
    !isRestricted(iteration) &&
    (validation === "NotRequired" || validation === "Approved") &&
    iteration.cancellation === null
  );
}

// ---------------------------------------------------------------- displayed status

// Precedence table rows 4–11 of status-model.md §4; first match wins.
export function iterationStatusOf(iteration: Iteration): DisplayStatus {
  if (iteration.cancellation?.cause === "Decided") {
    return "Cancelled";
  }

  if (iteration.cancellation?.cause === "NotDigitizable") {
    return "NotDigitizable";
  }

  if (isProgressAtLeast(iteration.progress, "Digitized")) {
    return iteration.progress;
  }

  if (isRestricted(iteration)) {
    return "Forbidden";
  }

  const validation = validationOf(iteration);
  if (validation === "Denied") {
    return "ValidationDenied";
  }

  if (validation === "Needed") {
    return "ReviewNeeded";
  }

  return iteration.progress;
}

// Rows 1–3, for a document that has no iteration yet. An approved request without one is in
// the window before ingest.
export function decisionStatusOf(decision: Exclude<Decision, "Duplicate">): DisplayStatus {
  const statuses = {
    Pending: "AwaitingReview",
    Approved: "BeingAdded",
    Denied: "Declined",
    Withdrawn: "Withdrawn",
  } as const satisfies Record<typeof decision, DisplayStatus>;

  return statuses[decision];
}

// Once scanned, a new defect rides beside the progress badge instead of hiding it.
export function statusFootnoteOf(iteration: Iteration): StatusFootnote | null {
  if (!isProgressAtLeast(iteration.progress, "Digitized")) {
    return null;
  }

  const validation = validationOf(iteration);
  if (validation === "Needed") {
    return "ReviewNeeded";
  }

  return validation === "Denied" ? "ValidationDenied" : null;
}

// ---------------------------------------------------------------- public vocabulary

// What a requester reads about their own request. A request following other work shows that
// work's status, never the word "duplicate" (status-model.md §2.7).
export function publicStatusOf(request: Request, iteration: Iteration | null): PublicStatus {
  if (request.decision === "Pending") {
    return "WaitingForReview";
  }

  if (request.decision === "Denied") {
    return "NotAccepted";
  }

  if (request.decision === "Withdrawn") {
    return "Withdrawn";
  }

  return iteration === null ? "BeingAdded" : publicIterationStatusOf(iteration);
}

// The public status of an attempt, whoever asked for it.
export function publicIterationStatusOf(iteration: Iteration): PublicStatus {
  if (iteration.cancellation !== null) {
    return "OnHold";
  }

  if (iteration.progress === "IngestFailed") {
    return "BeingAdded";
  }

  if (isProgressAtLeast(iteration.progress, "Digitized")) {
    return "Available";
  }

  if (isRestricted(iteration)) {
    return "NotAvailable";
  }

  if (iteration.progress === "Planned" || iteration.progress === "InProgress") {
    return "Scheduled";
  }

  return iteration.progress === "Ready" && passesGates(iteration)
    ? "WaitingToBeScheduled"
    : "BeingChecked";
}
