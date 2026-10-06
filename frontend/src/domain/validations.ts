// Documents Validations' read model (view-map.md §2.3, docs/demos/shared/page-validation.js): one
// row per iteration whose metadata a defect holds, or that a rule forbade. Metadata only: an
// existing copy is a fact on the request and is never judged here. What a row says about itself
// is derived here, so the list, the pane and the server read it the same way.

import { z } from "zod";
import type { Defect, Iteration } from "@/domain/entities";
import { documentSchema, iterationSchema } from "@/domain/entities";
import {
  approvedKeysOf,
  deniedKeysOf,
  isProgressAtLeast,
  isRestricted,
  outstandingDefects,
  validationOf,
} from "@/domain/status";

// Where a row stands. Forbidden outranks review: a restriction is the one verdict nothing here
// discharges (status-model.md §4), so a forbidden item is filed apart, whatever its defects.
export const reviewStates = ["Needed", "Denied", "Approved", "Forbidden"] as const;
export const reviewStateSchema = z.enum(reviewStates);
export type ReviewState = z.infer<typeof reviewStateSchema>;

// What the Review filter offers: a forbidden item has no review state there, and is found by
// the Forbidden field instead (decided 2026-10-06).
export const reviewedStates = ["Needed", "Denied", "Approved"] as const;
export const reviewedStateSchema = z.enum(reviewedStates);
export type ReviewedState = z.infer<typeof reviewedStateSchema>;

export const validationRowSchema = z.object({
  iteration: iterationSchema,
  document: documentSchema,
  review: reviewStateSchema,
  // The oldest finding still to rule on, or the restriction: how long it has waited.
  waitingSince: z.iso.datetime(),
  // Everyone whose ask this attempt answers: who reads a denial.
  askerIds: z.array(z.string()),
});
export type ValidationRow = z.infer<typeof validationRowSchema>;

// Null when nothing holds it here: no defect and no restriction, or held by a cancellation, which
// is Documents' (it is resumed there).
export function reviewStateOf(iteration: Iteration): ReviewState | null {
  if (iteration.cancellation !== null) {
    return null;
  }

  if (isRestricted(iteration)) {
    return "Forbidden";
  }

  const validation = validationOf(iteration);
  return validation === "NotRequired" ? null : validation;
}

export function waitingSinceOf(iteration: Iteration): string {
  if (isRestricted(iteration) && iteration.restriction !== null) {
    return iteration.restriction.foundAt;
  }

  const outstanding = outstandingDefects(iteration);
  const findings = outstanding.length > 0 ? outstanding : iteration.defects;
  return findings.map((defect) => defect.firstSeenAt).toSorted()[0] ?? "";
}

// What is still to rule on: a defect already accepted does not put an item under its plugin, so
// an accepted page count leaves a page-count watchlist (page-validation.js).
export function defectsToRuleOn(iteration: Iteration): Defect[] {
  return validationOf(iteration) === "Needed" ? outstandingDefects(iteration) : iteration.defects;
}

// A ∩ D: accepted, and found again by the last check.
export function acceptedDefectsOf(iteration: Iteration): Defect[] {
  const approvedKeys = approvedKeysOf(iteration);
  return iteration.defects.filter((defect) => approvedKeys.has(defect.key));
}

// N ∩ D: ruled substantial and still there; the denial lapses with the last of them.
export function deniedDefectsOf(iteration: Iteration): Defect[] {
  const deniedKeys = deniedKeysOf(iteration);
  return iteration.defects.filter((defect) => deniedKeys.has(defect.key));
}

// Found after digitization (C10): progress never moves back, and the scan has counted the pages.
export function isFoundAfterScan(iteration: Iteration): boolean {
  return isProgressAtLeast(iteration.progress, "Digitized");
}

// What a defect is about when it is the page count: the one value entered in VERA, which runs
// the checks again (decided 2026-10-06). Every other defect is repaired in the catalog.
export const pagesSubject = "pages";

// A defect's own name, "PageCount R03".
export function defectNameOf(defect: Defect): string {
  return `${defect.plugin} ${defect.ruleCode}`;
}
