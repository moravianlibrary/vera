// How filter values shared by several views read on their chips and in their pickers.
// TODO(rrandiak): labels move to i18n.

import type { Answer } from "@/api/documents";
import type { ExistingCopyState } from "@/domain/documents";

export const answerLabels = { Yes: "Yes", No: "No" } as const satisfies Record<Answer, string>;

export const existingCopyLabels = {
  None: "No copy",
  CheckFailed: "Check failed",
  Unmapped: "Unmapped",
  Planned: "Planned",
  InProgress: "In progress",
  Digitized: "Digitized",
  Published: "Published",
} as const satisfies Record<ExistingCopyState, string>;
