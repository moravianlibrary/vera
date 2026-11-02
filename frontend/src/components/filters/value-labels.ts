// How filter values shared by several views read on their chips and in their pickers.
// Vocabulary values are message keys; callers translate when displaying them.

import type { Answer } from "@vera/contract/documents";
import type { ExistingCopyState } from "@vera/domain/documents";
import type { RegistryState } from "@vera/domain/entities";

export const answerLabels = {
  Yes: "common:answer.Yes",
  No: "common:answer.No",
} as const satisfies Record<Answer, string>;

export const existingCopyLabels = {
  None: "common:existingCopy.None",
  CheckFailed: "common:existingCopy.CheckFailed",
  Unmapped: "common:existingCopy.Unmapped",
  Planned: "common:existingCopy.Planned",
  InProgress: "common:existingCopy.InProgress",
  Digitized: "common:existingCopy.Digitized",
  Published: "common:existingCopy.Published",
  NotFound: "common:existingCopy.NotFound",
} as const satisfies Record<ExistingCopyState | Extract<RegistryState, "NotFound">, string>;
