// The counting rules for intentions, in one place because Intentions, Lists and Projects must
// agree (intentions.md §3, §6; docs/demos/shared/vera-data.js `intentionCount`, `shareWithin`).
// Nothing is attached: an item counts towards every intention whose funding and category scope
// it matches. Planned is what sits on a list that still exists and starts in the window;
// delivered is the part of it digitized in the window, plan completion; output is everything
// matching digitized in the window, whenever it was planned, and is what the mix is measured on.
// Figures of different intentions overlap and are never added. Windows include the first day
// and the last.

import { categoryLineageOf, categoryPathOf, leafCategoriesOf } from "@/domain/categories";
import type {
  Category,
  DigitizationList,
  Distribution,
  Intention,
  Iteration,
} from "@/domain/entities";
import { daysUntil, paceSlack, paceVerdicts, timeElapsedOf } from "@/domain/projects";
import { isProgressAtLeast } from "@/domain/status";

export const intentionStates = ["Running", "Upcoming", "Ended"] as const;
export type IntentionState = (typeof intentionStates)[number];

// The Projects verdicts, and a target already covered by what is planned.
export const targetVerdicts = [...paceVerdicts, "fullyPlanned"] as const;
export type TargetVerdict = (typeof targetVerdicts)[number];

// Points either way that still read as on the mix: display tolerance, not a change to the mix.
export const mixBand = 5;

export const mixFlags = ["inBand", "over", "under", "excludedUsed", "noShare"] as const;
export type MixFlag = (typeof mixFlags)[number];

// A planned figure under 95% of its share of the target reads as short.
const fillTolerance = 0.95;

// ---------------------------------------------------------------- window

export function isInWindow(
  intention: Pick<Intention, "countsFrom" | "endsOn">,
  calendarDate: string | null,
): boolean {
  return (
    calendarDate !== null &&
    calendarDate >= intention.countsFrom &&
    (intention.endsOn === null || calendarDate <= intention.endsOn)
  );
}

export function intentionStateOf(
  intention: Pick<Intention, "countsFrom" | "endsOn">,
  today: string,
): IntentionState {
  if (today < intention.countsFrom) {
    return "Upcoming";
  }

  return intention.endsOn !== null && today > intention.endsOn ? "Ended" : "Running";
}

// The share of the window gone by today, 0 to 1; null for an open-ended one, which has no pace.
export function intentionTimeElapsedOf(
  intention: Pick<Intention, "countsFrom" | "endsOn">,
  today: string,
): number | null {
  return intention.endsOn === null
    ? null
    : timeElapsedOf({ startsOn: intention.countsFrom, endsOn: intention.endsOn }, today);
}

// ---------------------------------------------------------------- counting

export interface CountingData {
  readonly categories: readonly Category[];
  readonly lists: readonly DigitizationList[];
  readonly iterations: readonly Iteration[];
  // The page count in use; null where nobody knows it yet.
  readonly pagesOf: (iteration: Iteration) => number | null;
}

export interface IntentionCount {
  readonly planned: readonly Iteration[];
  readonly delivered: readonly Iteration[];
  readonly output: readonly Iteration[];
  readonly plannedPages: number;
  readonly deliveredPages: number;
  readonly outputPages: number;
  // Matching and digitized with no date recorded: shown as not counted, never dropped silently.
  readonly noDateCount: number;
  // Counted, with no page count to add.
  readonly noPagesCount: number;
}

export function isInIntentionScope(
  intention: Pick<Intention, "funding" | "scopeCategoryId">,
  iteration: Pick<Iteration, "projectId" | "categoryId">,
  categories: readonly Category[],
): boolean {
  const { funding } = intention;
  const isFundingMatched =
    funding.kind === "any" ||
    (funding.kind === "none"
      ? iteration.projectId === null
      : iteration.projectId === funding.projectId);
  return (
    isFundingMatched &&
    (intention.scopeCategoryId === null ||
      categoryLineageOf(categories, iteration.categoryId).includes(intention.scopeCategoryId))
  );
}

const isDigitized = (iteration: Iteration) => isProgressAtLeast(iteration.progress, "Digitized");

// When it was digitized: recorded, or the last day of the list it was on.
function digitizedOnOf(iteration: Iteration, lists: readonly DigitizationList[]): string | null {
  if (!isDigitized(iteration)) {
    return null;
  }

  if (iteration.digitizedAt !== null) {
    return iteration.digitizedAt.slice(0, 10);
  }

  return lists.find((list) => list.id === iteration.listId)?.endsOn ?? null;
}

export function countIntention(intention: Intention, data: CountingData): IntentionCount {
  const { lists, pagesOf } = data;
  const matching = data.iterations.filter((iteration) =>
    isInIntentionScope(intention, iteration, data.categories),
  );
  const listOf = (iteration: Iteration) => lists.find((list) => list.id === iteration.listId);
  // A deleted list's items stop counting; a cancelled item too, unless it was delivered.
  const planned = matching.filter((iteration) => {
    const list = listOf(iteration);
    return (
      list !== undefined &&
      isInWindow(intention, list.startsOn) &&
      (iteration.cancellation === null || isDigitized(iteration))
    );
  });
  const isDigitizedInWindow = (iteration: Iteration) =>
    isInWindow(intention, digitizedOnOf(iteration, lists));
  const delivered = planned.filter(isDigitizedInWindow);
  const output = matching.filter(isDigitizedInWindow);
  const pagesIn = (iterations: readonly Iteration[]) =>
    iterations.reduce((sum, iteration) => sum + (pagesOf(iteration) ?? 0), 0);
  return {
    planned,
    delivered,
    output,
    plannedPages: pagesIn(planned),
    deliveredPages: pagesIn(delivered),
    outputPages: pagesIn(output),
    noDateCount: matching.filter(
      (iteration) => isDigitized(iteration) && digitizedOnOf(iteration, lists) === null,
    ).length,
    noPagesCount: new Set(
      [...planned, ...output].filter((iteration) => pagesOf(iteration) === null),
    ).size,
  };
}

// ---------------------------------------------------------------- progress against a target

export interface TargetInput {
  intention: Pick<Intention, "countsFrom" | "endsOn" | "targetPages">;
  plannedPages: number;
  deliveredPages: number;
  today: string;
}

// Linear pace, read with the Projects slack, only for a target with an end; an open-ended one is
// at most fully planned or met. Pace is a straight line, never a forecast.
export function targetVerdictOf({
  intention,
  plannedPages,
  deliveredPages,
  today,
}: TargetInput): TargetVerdict | null {
  const target = intention.targetPages;
  if (target === null) {
    return null;
  }

  const state = intentionStateOf(intention, today);
  const isMet = deliveredPages >= target;
  const isFullyPlanned = plannedPages >= target;
  if (state === "Upcoming") {
    return isFullyPlanned ? "fullyPlanned" : null;
  }

  if (state === "Ended") {
    return isMet ? "targetMet" : "short";
  }

  if (isMet) {
    return "targetMet";
  }

  const timeElapsed = intentionTimeElapsedOf(intention, today);
  if (timeElapsed === null) {
    return isFullyPlanned ? "fullyPlanned" : null;
  }

  return deliveredPages / target >= timeElapsed - paceSlack ? "onPace" : "behindPace";
}

// Pages a week from now to the end that would still reach the target, in tens.
export function pagesPerWeekNeededOf({
  intention,
  deliveredPages,
  today,
}: Omit<TargetInput, "plannedPages">): number | null {
  const target = intention.targetPages;
  if (
    target === null ||
    intention.endsOn === null ||
    intentionStateOf(intention, today) !== "Running" ||
    deliveredPages >= target
  ) {
    return null;
  }

  const weeks = Math.max(1, daysUntil(intention.endsOn, today) + 1) / 7;
  return Math.ceil((target - deliveredPages) / weeks / 10) * 10;
}

// What a behind-pace target is short of an even pace on lists, in tens: what a catch-up
// Generate is pre-filled with (STATUS, *A behind-pace target gets a catch-up Generate*).
export function catchUpPagesOf(input: TargetInput): number | null {
  const target = input.intention.targetPages;
  const timeElapsed = intentionTimeElapsedOf(input.intention, input.today);
  if (target === null || timeElapsed === null || targetVerdictOf(input) !== "behindPace") {
    return null;
  }

  return Math.max(0, Math.round((target * timeElapsed - input.plannedPages) / 10) * 10);
}

// ---------------------------------------------------------------- the mix

// The intention whose mix it reads: itself, or the owner it tracks. No chains (§2).
export function mixOwnerOf(intention: Intention, intentions: readonly Intention[]): Intention {
  return intentions.find((candidate) => candidate.id === intention.tracksMixOf) ?? intention;
}

export function trackersOf(owner: Intention, intentions: readonly Intention[]): Intention[] {
  return intentions.filter((candidate) => candidate.tracksMixOf === owner.id);
}

// The categories the mix is read across: the scope's children, or the top of the tree. A leaf
// scope has none: it is one category, all of it.
export function mixCategoriesOf(
  categories: readonly Category[],
  scopeCategoryId: string | null,
): Category[] {
  return categories.filter((category) => category.parentId === scopeCategoryId);
}

// A share read inside the scope: the scope node is 100% and its children split it, recursively
// (§3.2). A change of reference frame, not a rescale; null where something on the way down has no
// share.
export function shareWithinOf(
  categories: readonly Category[],
  distribution: Pick<Distribution, "shares">,
  scopeCategoryId: string | null,
  categoryId: string,
): number | null {
  const path = categoryPathOf(categories, categoryId);
  const scopeIndex = path.findIndex((category) => category.id === scopeCategoryId);
  if (scopeCategoryId !== null && scopeIndex === -1) {
    return null;
  }

  const below = path.slice(scopeIndex + 1);
  let share = 100;
  for (const category of below) {
    const own = distribution.shares[category.id];
    if (own === undefined) {
      return null;
    }

    share = (share * own) / 100;
  }

  return share;
}

export interface MixRow {
  readonly categoryId: string;
  // Within the scope, in percent; null with no share.
  readonly intended: number | null;
  // Of the planned pages, and of the output, each over its own total; null with none.
  readonly planned: number | null;
  readonly output: number | null;
  readonly outputPages: number;
  // Output minus intended, in points.
  readonly drift: number | null;
  readonly flag: MixFlag | null;
}

export interface MixReading {
  readonly rows: readonly MixRow[];
  // Percent of the scope no category has a share of.
  readonly unallocated: number;
  // Over or under the band, or a 0% category used.
  readonly outOfBandCount: number;
}

const percentOf = (part: number, whole: number) => (whole === 0 ? null : (part / whole) * 100);

export function mixReadingOf(
  intention: Pick<Intention, "scopeCategoryId">,
  distribution: Pick<Distribution, "shares">,
  count: Pick<IntentionCount, "planned" | "output" | "plannedPages" | "outputPages">,
  data: Pick<CountingData, "categories" | "pagesOf">,
): MixReading {
  const { categories, pagesOf } = data;
  const nodes = mixCategoriesOf(categories, intention.scopeCategoryId);
  const pagesUnder = (categoryId: string, iterations: readonly Iteration[]) =>
    iterations
      .filter((iteration) =>
        categoryLineageOf(categories, iteration.categoryId).includes(categoryId),
      )
      .reduce((sum, iteration) => sum + (pagesOf(iteration) ?? 0), 0);
  const rows = nodes.map((category): MixRow => {
    const intended = shareWithinOf(
      categories,
      distribution,
      intention.scopeCategoryId,
      category.id,
    );
    const outputPages = pagesUnder(category.id, count.output);
    const output = percentOf(outputPages, count.outputPages);
    const drift = intended === null || output === null ? null : output - intended;
    return {
      categoryId: category.id,
      intended,
      planned: percentOf(pagesUnder(category.id, count.planned), count.plannedPages),
      output,
      outputPages,
      drift,
      flag: flagOf(intended, outputPages, drift),
    };
  });
  const allocated = nodes.reduce(
    (sum, category) => sum + (distribution.shares[category.id] ?? 0),
    0,
  );
  return {
    rows,
    unallocated: nodes.length === 0 ? 0 : Math.max(0, 100 - allocated),
    outOfBandCount: rows.filter(
      (row) => row.flag === "over" || row.flag === "under" || row.flag === "excludedUsed",
    ).length,
  };
}

function flagOf(
  intended: number | null,
  outputPages: number,
  drift: number | null,
): MixFlag | null {
  if (intended === 0 && outputPages > 0) {
    return "excludedUsed";
  }

  if (intended === null) {
    return "noShare";
  }

  if (drift === null) {
    return null;
  }

  if (Math.abs(drift) <= mixBand) {
    return "inBand";
  }

  return drift > 0 ? "over" : "under";
}

// ---------------------------------------------------------------- fill of a target

export interface FillRow {
  readonly categoryId: string;
  // Within the scope; null with no share, 0 excluded.
  readonly share: number | null;
  // Its share of the target.
  readonly targetPages: number | null;
  readonly plannedPages: number;
  readonly deliveredPages: number;
  readonly isShort: boolean;
}

// Per leaf of the scope: its share of the target, and what is planned and delivered in it.
export function fillOf(
  intention: Pick<Intention, "scopeCategoryId" | "targetPages">,
  distribution: Pick<Distribution, "shares">,
  count: Pick<IntentionCount, "planned" | "delivered">,
  data: Pick<CountingData, "categories" | "pagesOf">,
): FillRow[] {
  const { categories, pagesOf } = data;
  const scope = intention.scopeCategoryId;
  const leaves = leafCategoriesOf(categories).filter(
    (leaf) => scope === null || categoryLineageOf(categories, leaf.id).includes(scope),
  );
  const pagesIn = (categoryId: string, iterations: readonly Iteration[]) =>
    iterations
      .filter((iteration) => iteration.categoryId === categoryId)
      .reduce((sum, iteration) => sum + (pagesOf(iteration) ?? 0), 0);
  return leaves.map((leaf) => {
    const share = shareWithinOf(categories, distribution, scope, leaf.id);
    const targetPages =
      share === null || share === 0 || intention.targetPages === null
        ? null
        : Math.round((intention.targetPages * share) / 100);
    const plannedPages = pagesIn(leaf.id, count.planned);
    return {
      categoryId: leaf.id,
      share,
      targetPages,
      plannedPages,
      deliveredPages: pagesIn(leaf.id, count.delivered),
      isShort: targetPages !== null && plannedPages < targetPages * fillTolerance,
    };
  });
}
