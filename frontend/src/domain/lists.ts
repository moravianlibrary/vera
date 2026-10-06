// What a digitization list is now, worked out rather than stored (view-map.md §2.4, flows.md
// L1–L17): its state follows its dates until someone marks it Done, its members' progress
// follows its start, and a member that a gate stops after it was listed stays on, flagged.

import { z } from "zod";
import type { DigitizationList, Iteration, Progress } from "@/domain/entities";
import { isProgressAtLeast, iterationStatusOf } from "@/domain/status";

// Planned before it starts, In progress from that day, Done once marked: Done is an act, the
// other two are never written (decided 2026-09-26).
export const listStates = ["Planned", "InProgress", "Done"] as const;
export const listStateSchema = z.enum(listStates);
export type ListState = z.infer<typeof listStateSchema>;

// `today` is a calendar day, YYYY-MM-DD, as the server's clock gives it.
export function listStateOf(list: DigitizationList, today: string): ListState {
  if (list.done !== null) {
    return "Done";
  }

  return list.startsOn > today ? "Planned" : "InProgress";
}

// Past its end and still not marked Done: someone has to say what was scanned.
export function isOverdue(list: DigitizationList, today: string): boolean {
  return list.done === null && list.endsOn < today;
}

// What a member reads while the list has not been marked Done (flows.md L1, L2).
export function progressOnList(list: DigitizationList, today: string): Progress {
  return listStateOf(list, today) === "Planned" ? "Planned" : "InProgress";
}

export function isScanned(iteration: Iteration): boolean {
  return isProgressAtLeast(iteration.progress, "Digitized");
}

// A gate that started failing after the member was listed (flows.md L11). It stays on the list
// until the dig-curator takes it off; a scan or a cancellation is not a blocker.
export const memberBlockers = ["Forbidden", "ReviewNeeded", "ValidationDenied"] as const;
export const memberBlockerSchema = z.enum(memberBlockers);
export type MemberBlocker = z.infer<typeof memberBlockerSchema>;

export function memberBlockerOf(iteration: Iteration): MemberBlocker | null {
  const status = iterationStatusOf(iteration);
  return memberBlockers.find((blocker) => blocker === status) ?? null;
}
