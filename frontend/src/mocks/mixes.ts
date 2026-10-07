// What the server does with an intention's mix (intentions.md §1, §2.2–§2.5): read it over the
// tree against the intention's output, write one sibling set whole against the revision read,
// and detach a tracker onto its own copy. A tracker reads its owner's mix. A scoped intention
// reads only its subtree: shares outside it, the scope's own included, are not sent, and inside
// it each is of the scope, not of the whole (§3.2). Only the owner's mix is written, under
// `intention.edit` on it, Overall's under `intention.edit_overall`; every tracker changes with
// it, and one kept on the old mix is detached first, under `intention.edit` on that tracker.

import type { IntentionMixDetail, MixSetDraft, MixTree } from "@/api/mixes";
import { isInSubtree } from "@/domain/categories";
import type { Intention, Session } from "@/domain/entities";
import {
  countIntention,
  intentionStateOf,
  mixOwnerOf,
  scopeOfIntention,
  shareWithinOf,
  trackersOf,
} from "@/domain/intentions";
import { siblingSetOf } from "@/domain/mixes";
import { can } from "@/domain/permissions";
import { dayOf } from "@/lib/value-range";
import { database } from "@/mocks/database";
import {
  copyMixOf,
  countingData,
  distributionOf,
  intentionFor,
  isVisible,
  replaceIntention,
} from "@/mocks/intentions";
import type { Outcome, Refusal } from "@/mocks/mutations";
import { mockToday } from "@/mocks/today";

// What a set the scope does not use reads as: nothing to flag.
const noSet = { unallocated: 0, noShareIds: [] };

export function mixTreeOf(intention: Intention): MixTree {
  const { categories, intentions } = database;
  const owner = mixOwnerOf(intention, intentions);
  const { shares } = distributionOf(owner);
  const scope = intention.scopeCategoryId;
  const isInScope = (categoryId: string) =>
    scope === null || isInSubtree(categories, categoryId, scope);
  const isBelowScope = (categoryId: string) => isInScope(categoryId) && categoryId !== scope;
  const data = countingData();
  const { output, outputPages } = countIntention(intention, data);
  const outputUnder = (categoryId: string) =>
    output
      .filter((iteration) => isInSubtree(categories, iteration.categoryId, categoryId))
      .reduce((sum, iteration) => sum + (data.pagesOf(iteration) ?? 0), 0);
  return {
    intention,
    owner,
    outputPages,
    ...(scope === null ? siblingSetOf(categories, shares, null) : noSet),
    nodes: categories.map((category) => ({
      categoryId: category.id,
      share: isBelowScope(category.id) ? (shares[category.id] ?? null) : null,
      ofWhole: isInScope(category.id)
        ? shareWithinOf(categories, { shares }, scope, category.id)
        : null,
      actual:
        isInScope(category.id) && outputPages > 0
          ? (outputUnder(category.id) / outputPages) * 100
          : null,
      ...(isInScope(category.id) ? siblingSetOf(categories, shares, category.id) : noSet),
    })),
  };
}

// The trackers the caller can see; one not listed yet, a Proposed project's, changes all the same.
function detailOf(session: Session, intention: Intention): IntentionMixDetail {
  const owner = mixOwnerOf(intention, database.intentions);
  const today = dayOf(mockToday);
  return {
    mix: mixTreeOf(intention),
    revision: distributionOf(owner).revision,
    trackers: trackersOf(owner, database.intentions)
      .filter((tracker) => isVisible(session, tracker))
      .map((tracker) => ({
        intention: tracker,
        state: intentionStateOf(tracker, today),
      })),
  };
}

const notFound: Refusal = { status: 404, message: "Intention not found" };

export function findIntentionMix(session: Session, intentionId: string): IntentionMixDetail | null {
  const intention = database.intentions.find((candidate) => candidate.id === intentionId);
  return intention === undefined || !isVisible(session, intention)
    ? null
    : detailOf(session, intention);
}

const canEdit = (session: Session, intention: Intention) =>
  intention.isOverall
    ? can(session, "intention.edit_overall")
    : can(session, "intention.edit", scopeOfIntention(intention, database.projects));

// The children the set must name, exactly, or why it cannot be written.
function setRefusal(owner: Intention, draft: MixSetDraft): Refusal | null {
  const { categories } = database;
  const { parentId } = draft;
  if (parentId !== null && !categories.some((category) => category.id === parentId)) {
    return { status: 422, message: `No category ${parentId}` };
  }

  const scope = owner.scopeCategoryId;
  if (scope !== null && (parentId === null || !isInSubtree(categories, parentId, scope))) {
    return {
      status: 422,
      message: "Its scope does not use that set",
      code: "mix.outside_scope",
    };
  }

  const childIds = categories
    .filter((category) => category.parentId === parentId)
    .map((category) => category.id);
  const named = Object.keys(draft.shares);
  if (
    childIds.length === 0 ||
    named.length !== childIds.length ||
    childIds.some((id) => !named.includes(id))
  ) {
    return { status: 422, message: "A set names every child of its parent, and only those" };
  }

  const sum = Object.values(draft.shares).reduce<number>((total, share) => total + (share ?? 0), 0);
  return sum > 100 ? { status: 422, message: "A set cannot pass 100", code: "mix.over" } : null;
}

// The set written whole, on the owner, against the revision read (§1.1). Trackers kept on the old
// mix are detached first, each onto its own copy; the rest change with it.
export function saveMixSet(
  session: Session,
  intentionId: string,
  draft: MixSetDraft,
): Outcome<IntentionMixDetail> {
  const owner = database.intentions.find((candidate) => candidate.id === intentionId);
  if (owner === undefined || !isVisible(session, owner)) {
    return { refusal: notFound };
  }

  if (owner.tracksMixOf !== null) {
    return {
      refusal: {
        status: 409,
        message: "It tracks another's mix: edit that one, or detach it first",
        code: "intention.not_owner",
      },
    };
  }

  if (!canEdit(session, owner)) {
    return { refusal: { status: 403, message: "You may not change this mix" } };
  }

  const distribution = distributionOf(owner);
  if (draft.revision !== distribution.revision) {
    return {
      refusal: {
        status: 409,
        message: "Somebody changed this mix meanwhile; read it again",
        code: "mix.revision",
      },
    };
  }

  const refusal = setRefusal(owner, draft);
  if (refusal !== null) {
    return { refusal };
  }

  const trackers = trackersOf(owner, database.intentions);
  const kept = trackers.filter((tracker) => draft.keepOldMixFor.includes(tracker.id));
  if (kept.length !== new Set(draft.keepOldMixFor).size) {
    return { refusal: { status: 422, message: "Only an intention tracking it keeps the old mix" } };
  }

  if (kept.some((tracker) => !isVisible(session, tracker) || !canEdit(session, tracker))) {
    return {
      refusal: { status: 403, message: "You may not detach every intention kept on the old mix" },
    };
  }

  for (const tracker of kept) {
    detach(tracker, owner);
  }

  const shares = { ...distribution.shares };
  for (const [categoryId, share] of Object.entries(draft.shares)) {
    if (share === null) {
      delete shares[categoryId];
    } else {
      shares[categoryId] = share;
    }
  }

  database.distributions = database.distributions.map((candidate) =>
    candidate.id === distribution.id
      ? { ...candidate, shares, revision: candidate.revision + 1 }
      : candidate,
  );
  return { value: detailOf(session, owner) };
}

function detach(tracker: Intention, owner: Intention): Intention {
  const copy = copyMixOf(owner, tracker.id);
  const detached: Intention = { ...tracker, tracksMixOf: null, distributionId: copy.id };
  replaceIntention(detached);
  return detached;
}

// A tracker gets its own copy of the mix as it is now, and owns it (§2.2).
export function detachIntention(
  session: Session,
  intentionId: string,
): Outcome<IntentionMixDetail> {
  const found = intentionFor(session, intentionId);
  if ("refusal" in found) {
    return found;
  }

  const tracker = found.value;
  const owner = database.intentions.find((candidate) => candidate.id === tracker.tracksMixOf);
  if (owner === undefined) {
    return {
      refusal: { status: 409, message: "It owns its mix already", code: "intention.owner" },
    };
  }

  return { value: detailOf(session, detach(tracker, owner)) };
}
