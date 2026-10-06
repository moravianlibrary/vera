// The list generator plugin instances (docs/demos/shared/vera-data.js pt11, pt12; plugins.md
// §4.9) and the one mix generation is shaped by until intentions are in the mock API: the
// Overall intention, House mix, with its Standard mix (vera-data.js i4, d1).
// TODO(rrandiak): *Shape by* another intention, and correcting allocations, come with intentions
// (plan.md step 6); the instances move to the Plugins fixtures with step 10.

import type { ListGenerator } from "@/api/lists";
import type { Shares } from "@/domain/mixes";

export interface ListGeneratorInstance extends ListGenerator {
  readonly isEnabled: boolean;
}

export const listGenerators: readonly ListGeneratorInstance[] = [
  {
    id: "pi14",
    name: "Priority, then age",
    plugin: "PriorityFirst",
    version: "1.2.0",
    generatorClass: "RuleBased",
    description:
      "Fills each category to its share, highest priority first, then the oldest ask. Deterministic.",
    tolerance: 0.05,
    isEnabled: true,
  },
  {
    id: "pi15",
    name: "Pilot",
    plugin: "ShelfAdvisor",
    version: "0.4.0",
    generatorClass: "AiBased",
    description:
      "A model reads the pool and proposes a list, giving its own reason for every pick. Not deterministic.",
    tolerance: 0.08,
    isEnabled: true,
  },
];

export const overallIntention = { intentionId: "i4", name: "House mix" } as const;

export const overallShares: Shares = {
  c1: 35,
  c2: 45,
  c3: 15,
  c4: 5,
  c11: 40,
  c12: 60,
  c21: 30,
  c22: 50,
  c23: 20,
  c31: 60,
  c32: 40,
};

// What the AI-based generator says for itself: the model's own sentence per pick.
export const advisorReasons: Readonly<Record<string, string>> = {
  IT3: "Urgent and asked for an exhibition; its page count was reviewed and accepted.",
  IT26: "The oldest unscanned regional weekly in the pool; pairs with the Znojmo run already planned.",
  IT27: "A founding year of the regional press — likely to be asked for again.",
  IT28: "Fills the National share at a modest size.",
  IT29: "The only Specialist title ready without a copy elsewhere.",
  IT15: "Fits the Specialist share, but Kramerius published a copy on 24 Jun — probably not needed.",
  IT8: "A rescan at 400 dpi colour; the 2019 copy is greyscale.",
  IT30: "Small, and the 19th-century share is otherwise empty.",
  IT31: "High priority for VISK 7 and short.",
  IT4: "Fills out the 20th-century share.",
  IT32: "High priority; handled by the manuscript studio anyway this month.",
  IT33: "Early modern share; the only one ready.",
};
