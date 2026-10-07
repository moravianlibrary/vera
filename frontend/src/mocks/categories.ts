// What the server does for Categories (concepts.md *Category*; intentions.md §2.4; STATUS
// "Categories"): total each category's subtree, resolve who holds custody of it and whom that
// reaches, and read Overall's mix over the tree for whoever may read intentions. No other mix:
// one is read and edited on its intention (`mocks/mixes.ts`).
// Changing the tree (permissions.md §3, Categories; intentions.md §1.1.1, §1.2): create, rename
// and move, delete, refine, under `category.edit`; the custody set under
// `category.grant_custody`. At `custody` each reaches the person's own subtree only, and the top
// level is `any`'s. Nothing rebalances a mix: a category entering a sibling set has no share there,
// and one leaving a set leaves its share unallocated, flagged.

import type {
  CategoryDraft,
  CategoryImpact,
  CategoryIndex,
  CategoryNode,
  CategoryTotals,
  CustodyDraft,
  CustodyGrant,
  MixShare,
  RefineDraft,
} from "@/api/categories";
import type { CustodyHolders } from "@/domain/categories";
import {
  categoryPathOf,
  custodyReachOf,
  isInSubtree,
  isNameTaken,
  scopeOfCategory,
  unheldCategoriesOf,
} from "@/domain/categories";
import type { Category, Distribution, Iteration, Session } from "@/domain/entities";
import { trackersOf } from "@/domain/intentions";
import { isInPool, isScanned } from "@/domain/lists";
import type { Permission } from "@/domain/permissions";
import { can } from "@/domain/permissions";
import { database } from "@/mocks/database";
import { countingData, isVisible, nextId, overallIntention } from "@/mocks/intentions";
import { mixTreeOf } from "@/mocks/mixes";
import type { Outcome, Refusal } from "@/mocks/mutations";
import { replaceIteration, writeLog } from "@/mocks/mutations";

export function canReadCategories(session: Session): boolean {
  return can(session, "category.read");
}

const holders = (): CustodyHolders => ({
  groups: database.groups,
  members: database.categoryMembers,
});

const nameOfUser = (userId: string) =>
  database.users.find((user) => user.id === userId)?.name ?? userId;
const nameOfCategory = (categoryId: string) =>
  database.categories.find((category) => category.id === categoryId)?.name ?? categoryId;

function totalsOf(iterations: readonly Iteration[]): CategoryTotals {
  const { pagesOf } = countingData();
  const pagesIn = (of: readonly Iteration[]) =>
    of.reduce((sum, iteration) => sum + (pagesOf(iteration) ?? 0), 0);
  return {
    documentCount: iterations.length,
    pages: pagesIn(iterations),
    deliveredPages: pagesIn(iterations.filter(isScanned)),
    readyPages: pagesIn(iterations.filter(isInPool)),
  };
}

function nodeOf(categoryId: string): CategoryNode {
  const { categories, iterations } = database;
  const custody = holders();
  const grants: CustodyGrant[] = [
    ...custody.groups
      .filter((group) => group.categoryIds.includes(categoryId))
      .map((group): CustodyGrant => ({ kind: "group", id: group.id, name: group.name })),
    ...(custody.members[categoryId] ?? []).map(
      (userId): CustodyGrant => ({ kind: "person", id: userId, name: nameOfUser(userId) }),
    ),
  ];
  return {
    categoryId,
    ...totalsOf(
      iterations.filter((iteration) => isInSubtree(categories, iteration.categoryId, categoryId)),
    ),
    grants,
    reach: custodyReachOf(categories, custody, categoryId).map((reach) => {
      const group = custody.groups.find((candidate) => candidate.id === reach.groupId);
      return {
        userId: reach.userId,
        name: nameOfUser(reach.userId),
        group: group === undefined ? null : { id: group.id, name: group.name },
        grantedOn: { id: reach.categoryId, name: nameOfCategory(reach.categoryId) },
      };
    }),
  };
}

export function queryCategoryIndex(session: Session): CategoryIndex {
  const { categories, iterations } = database;
  return {
    totals: totalsOf(iterations),
    nodes: categories.map((category) => nodeOf(category.id)),
    mix: can(session, "intention.read") ? mixTreeOf(overallIntention()) : null,
    unheldIds: unheldCategoriesOf(categories, holders()).map((category) => category.id),
  };
}

// ---------------------------------------------------------------- changing the tree

const notFound: Refusal = { status: 404, message: "No such category" };

const mayOn = (session: Session, permission: Permission, categoryId: string | null) =>
  can(session, permission, scopeOfCategory(database.categories, categoryId));

const holdsDocuments = (categoryId: string) =>
  database.iterations.some((iteration) => iteration.categoryId === categoryId);

const hasChildren = (categoryId: string) =>
  database.categories.some((category) => category.parentId === categoryId);

function findCategory(categoryId: string): Category | null {
  return database.categories.find((category) => category.id === categoryId) ?? null;
}

// Whether it may sit under the parent: an existing one, inside the person's reach, and not a leaf
// holding documents, which would stop them being on a leaf (intentions.md §1.2).
function placeRefusal(session: Session, parentId: string | null): Refusal | null {
  if (parentId !== null && findCategory(parentId) === null) {
    return { status: 422, message: `No category ${parentId}` };
  }

  if (!mayOn(session, "category.edit", parentId)) {
    return {
      status: 403,
      message:
        parentId === null
          ? "Only an administrator changes the top level"
          : "You may change the tree only inside your own custody",
    };
  }

  if (parentId !== null && !hasChildren(parentId) && holdsDocuments(parentId)) {
    return {
      status: 409,
      message: "It holds documents, so it cannot take a child: refine it instead",
      code: "category.holds_documents",
    };
  }

  return null;
}

function nameRefusal(parentId: string | null, name: string, exceptId: string | null) {
  return isNameTaken(database.categories, parentId, name, exceptId)
    ? ({
        status: 409,
        message: "A category beside it already has that name",
        code: "category.name_taken",
      } satisfies Refusal)
    : null;
}

// Each mix that had a share on them loses it, and its revision moves on, so an editor opened on
// the old set is refused rather than writing it back (intentions.md §1.1).
function dropShares(categoryId: string): void {
  database.distributions = database.distributions.map((distribution) => {
    if (distribution.shares[categoryId] === undefined) {
      return distribution;
    }

    const { [categoryId]: _dropped, ...shares } = distribution.shares;
    return { ...distribution, shares, revision: distribution.revision + 1 };
  });
}

// TODO(rrandiak): intentions.md §1.1.1 gives a new or moved category 0%, which since 2026-10-07
// reads as deliberately excluded; it gets no share instead, so its set is flagged until somebody
// decides. Confirm, or make it 0.
export function createCategory(session: Session, draft: CategoryDraft): Outcome<Category> {
  const name = draft.name.trim();
  const refusal = placeRefusal(session, draft.parentId) ?? nameRefusal(draft.parentId, name, null);
  if (refusal !== null) {
    return { refusal };
  }

  const category: Category = {
    id: nextId(
      "c",
      database.categories.map(({ id }) => id),
    ),
    name,
    parentId: draft.parentId,
  };
  database.categories = [...database.categories, category];
  return { value: category };
}

// Renamed, moved, or both. Moved, it takes its subtree along and starts with no share in its new
// set; where it was, its share becomes unallocated.
export function saveCategory(
  session: Session,
  categoryId: string,
  draft: CategoryDraft,
): Outcome<Category> {
  const category = findCategory(categoryId);
  if (category === null) {
    return { refusal: notFound };
  }

  if (!mayOn(session, "category.edit", categoryId)) {
    return { refusal: { status: 403, message: "You may not change this category" } };
  }

  const isMoved = draft.parentId !== category.parentId;
  if (
    isMoved &&
    draft.parentId !== null &&
    isInSubtree(database.categories, draft.parentId, categoryId)
  ) {
    return { refusal: { status: 422, message: "A category cannot go under itself" } };
  }

  const name = draft.name.trim();
  const refusal =
    (isMoved ? placeRefusal(session, draft.parentId) : null) ??
    nameRefusal(draft.parentId, name, categoryId);
  if (refusal !== null) {
    return { refusal };
  }

  const saved: Category = { ...category, name, parentId: draft.parentId };
  database.categories = database.categories.map((candidate) =>
    candidate.id === categoryId ? saved : candidate,
  );
  if (isMoved) {
    dropShares(categoryId);
  }

  return { value: saved };
}

// Who a mix is: an intention's own, or a repeat's that its intentions copy.
function ownerOf(distribution: Distribution) {
  return database.intentions.find((intention) => intention.id === distribution.ownerId) ?? null;
}

const scopedTo = (categoryId: string) => [
  ...database.intentions.filter((intention) => intention.scopeCategoryId === categoryId),
  ...database.intentionTemplates.filter((template) => template.scopeCategoryId === categoryId),
];

export function categoryImpact(session: Session, categoryId: string): Outcome<CategoryImpact> {
  const category = findCategory(categoryId);
  if (category === null || !canReadCategories(session)) {
    return { refusal: notFound };
  }

  const node = nodeOf(categoryId);
  const withShare = database.distributions.filter(
    (distribution) => distribution.shares[categoryId] !== undefined,
  );
  const shares = withShare.flatMap((distribution): MixShare[] => {
    const owner = ownerOf(distribution);
    return owner === null || !isVisible(session, owner)
      ? []
      : [
          {
            owner: { id: owner.id, name: owner.name },
            share: distribution.shares[categoryId] ?? 0,
            trackerCount: trackersOf(owner, database.intentions).length,
          },
        ];
  });
  const scoped = scopedTo(categoryId);
  const scopedIntentions = database.intentions.filter(
    (intention) => intention.scopeCategoryId === categoryId && isVisible(session, intention),
  );
  return {
    value: {
      documentCount: node.documentCount,
      pages: node.pages,
      shares,
      otherMixCount: withShare.length - shares.length,
      grantCount: node.grants.length,
      scopedIntentions: scopedIntentions.map(({ id, name }) => ({ id, name })),
      scopedIntentionCount: scoped.length,
    },
  };
}

// Only an empty leaf goes: documents sit on leaves and would be left on nothing, and a branch
// would take its subtree along. Its share in every set becomes unallocated, and custody granted on
// it goes with it.
export function deleteCategory(session: Session, categoryId: string): Outcome<null> {
  const category = findCategory(categoryId);
  if (category === null) {
    return { refusal: notFound };
  }

  if (!mayOn(session, "category.edit", categoryId)) {
    return { refusal: { status: 403, message: "You may not delete this category" } };
  }

  if (hasChildren(categoryId)) {
    return {
      refusal: {
        status: 409,
        message: "Only a category with nothing under it is deleted",
        code: "category.has_children",
      },
    };
  }

  if (holdsDocuments(categoryId)) {
    return {
      refusal: {
        status: 409,
        message: "It holds documents; reclassify them first",
        code: "category.holds_documents",
      },
    };
  }

  // TODO(rrandiak): an intention scoped to the category is refused for now; may the delete widen
  // its scope to the parent instead, or archive it?
  if (scopedTo(categoryId).length > 0) {
    return {
      refusal: {
        status: 409,
        message: "An intention is scoped to it",
        code: "category.scope",
      },
    };
  }

  database.categories = database.categories.filter((candidate) => candidate.id !== categoryId);
  dropShares(categoryId);
  database.groups = database.groups.map((group) =>
    group.categoryIds.includes(categoryId)
      ? { ...group, categoryIds: group.categoryIds.filter((id) => id !== categoryId) }
      : group,
  );
  const { [categoryId]: _members, ...members } = database.categoryMembers;
  database.categoryMembers = members;
  return { value: null };
}

// The set granted on the category, written whole (component-interfaces.md §6.5). At `custody` the
// person grants only inside their own subtree, so delegation cannot widen (permissions.md §3).
export function saveCategoryCustody(
  session: Session,
  categoryId: string,
  draft: CustodyDraft,
): Outcome<CategoryNode> {
  if (findCategory(categoryId) === null) {
    return { refusal: notFound };
  }

  if (!mayOn(session, "category.grant_custody", categoryId)) {
    return { refusal: { status: 403, message: "You may not grant custody here" } };
  }

  const isUnknown =
    draft.groupIds.some((groupId) => !database.groups.some((group) => group.id === groupId)) ||
    draft.userIds.some(
      (userId) => !database.users.some((user) => user.id === userId && user.kind === "person"),
    );
  if (isUnknown) {
    return { refusal: { status: 422, message: "Custody goes to existing groups and people" } };
  }

  database.groups = database.groups.map((group) => {
    const isGranted = draft.groupIds.includes(group.id);
    const others = group.categoryIds.filter((id) => id !== categoryId);
    return { ...group, categoryIds: isGranted ? [...others, categoryId] : others };
  });
  const { [categoryId]: _members, ...members } = database.categoryMembers;
  database.categoryMembers =
    draft.userIds.length === 0
      ? members
      : { ...members, [categoryId]: [...new Set(draft.userIds)] };
  return { value: nodeOf(categoryId) };
}

// A leaf that holds documents gains a child and every document moves into it (intentions.md §1.2,
// *A leaf that gains a child*). The child takes all of the leaf's share in each mix that gives it
// one, since it holds everything that was there; left with none, the branch would drop out of
// generation. Custody on the leaf still reaches them, and each document's history records the move.
export function refineCategory(
  session: Session,
  categoryId: string,
  draft: RefineDraft,
): Outcome<Category> {
  const category = findCategory(categoryId);
  if (category === null) {
    return { refusal: notFound };
  }

  if (!mayOn(session, "category.edit", categoryId)) {
    return { refusal: { status: 403, message: "You may not change this category" } };
  }

  if (hasChildren(categoryId)) {
    return {
      refusal: {
        status: 409,
        message: "Only a leaf is refined; this one has children already",
        code: "category.has_children",
      },
    };
  }

  const name = draft.name.trim();
  const refusal = nameRefusal(categoryId, name, null);
  if (refusal !== null) {
    return { refusal };
  }

  const child: Category = {
    id: nextId(
      "c",
      database.categories.map(({ id }) => id),
    ),
    name,
    parentId: categoryId,
  };
  database.categories = [...database.categories, child];
  database.distributions = database.distributions.map((distribution) =>
    distribution.shares[categoryId] === undefined
      ? distribution
      : {
          ...distribution,
          shares: { ...distribution.shares, [child.id]: 100 },
          revision: distribution.revision + 1,
        },
  );

  const path = (id: string) =>
    categoryPathOf(database.categories, id)
      .map((step) => step.name)
      .join(" / ");
  const at = new Date().toISOString();
  const correlationId = crypto.randomUUID();
  for (const iteration of database.iterations.filter(
    (candidate) => candidate.categoryId === categoryId,
  )) {
    replaceIteration({ ...iteration, categoryId: child.id });
    writeLog({
      subjectKind: "iteration",
      subjectId: iteration.id,
      at,
      actor: { kind: "user", userId: session.user.id },
      correlationId,
      event: "Reclassified",
      detail: `Category ${path(categoryId)} → ${path(child.id)}, as ${category.name} was refined.`,
    });
  }

  return { value: child };
}
