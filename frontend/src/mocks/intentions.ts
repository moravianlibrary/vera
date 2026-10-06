// What the server does for Intentions (intentions.md): keep intentions to the caller's reach,
// count each one by the rules of `domain/intentions.ts` against the lists and iterations as they
// are now, and resolve whose mix each reads. `intention.read@project` reaches an intention a
// project the caller is on funds; every other intention only `any` reaches (permissions.md §3).
// The acts keep the mix rules of §2: an intention tracks only one that owns its mix, so no chain
// is ever stored; an owner others track switches to tracking only by moving them with it; a copy
// is a new mix the intention owns. All of it is `intention.edit` on each intention changed, a
// repeat `intention.repeat`. A repeat's occurrences are fixtures; the mock makes no new ones.

import type {
  FillRowView,
  IntentionDeletion,
  IntentionDraft,
  IntentionIndex,
  IntentionList,
  IntentionMix,
  IntentionPreview,
  IntentionPreviewRequest,
  IntentionRow,
  IntentionScope,
  IntentionTemplateDraft,
  IntentionTemplateRow,
  MixChoice,
  MixRowView,
} from "@/api/intentions";
import { categoryPathOf } from "@/domain/categories";
import { effectivePageCount } from "@/domain/documents";
import type {
  Distribution,
  Intention,
  IntentionTemplate,
  Iteration,
  Session,
} from "@/domain/entities";
import type { CountingData } from "@/domain/intentions";
import {
  catchUpPagesOf,
  countIntention,
  fillOf,
  intentionStateOf,
  intentionTimeElapsedOf,
  mixCategoriesOf,
  mixOwnerOf,
  mixReadingOf,
  nextPeriodStartOf,
  pagesPerWeekNeededOf,
  scopeOfIntention,
  shareWithinOf,
  targetVerdictOf,
  trackersOf,
} from "@/domain/intentions";
import { can } from "@/domain/permissions";
import { daysUntil } from "@/domain/projects";
import { dayOf } from "@/lib/value-range";
import { database } from "@/mocks/database";
import type { Outcome, Refusal } from "@/mocks/mutations";
import { mockToday } from "@/mocks/today";

const today = () => dayOf(mockToday);

// ---------------------------------------------------------------- reach

export function canReadIntentions(session: Session): boolean {
  return can(session, "intention.read");
}

const scopeOf = (intention: Pick<Intention, "funding">) =>
  scopeOfIntention(intention, database.projects);

function isVisible(session: Session, intention: Intention): boolean {
  return can(session, "intention.read", scopeOf(intention));
}

// ---------------------------------------------------------------- counting

function pagesOf(iteration: Iteration): number | null {
  const document = database.documents.find((candidate) => candidate.id === iteration.documentId);
  return document === undefined ? null : (effectivePageCount(document)?.value ?? null);
}

export function countingData(): CountingData {
  return {
    categories: database.categories,
    lists: database.lists,
    iterations: database.iterations,
    pagesOf,
  };
}

// The mix the intention reads, which is its owner's.
export function distributionOf(intention: Pick<Intention, "distributionId">): Distribution {
  const distribution = database.distributions.find(
    (candidate) => candidate.id === intention.distributionId,
  );
  if (distribution === undefined) {
    throw new Error(`No mix ${intention.distributionId}`);
  }

  return distribution;
}

export function overallIntention(): Intention {
  const overall = database.intentions.find((intention) => intention.isOverall);
  if (overall === undefined) {
    throw new Error("No Overall intention");
  }

  return overall;
}

function mixOf(intention: Intention): IntentionMix {
  const owner = mixOwnerOf(intention, database.intentions);
  return {
    owner: { id: owner.id, name: owner.name, isOverall: owner.isOverall },
    isOwn: owner === intention,
    trackerCount: trackersOf(intention, database.intentions).length,
  };
}

const categoryName = (categoryId: string) =>
  database.categories.find((category) => category.id === categoryId)?.name ?? categoryId;

// From under the scope down, the whole path without one; a leaf scope is itself.
function pathWithin(scopeCategoryId: string | null, categoryId: string): string[] {
  const path = categoryPathOf(database.categories, categoryId);
  const scopeIndex = path.findIndex((category) => category.id === scopeCategoryId);
  const below = path.slice(scopeIndex + 1);
  return (below.length === 0 ? path.slice(-1) : below).map((category) => category.name);
}

function listsOf(planned: readonly Iteration[]): IntentionList[] {
  return database.lists.flatMap((list) => {
    const items = planned.filter((iteration) => iteration.listId === list.id);
    return items.length === 0
      ? []
      : [
          {
            id: list.id,
            name: list.name,
            itemCount: items.length,
            pages: items.reduce((sum, iteration) => sum + (pagesOf(iteration) ?? 0), 0),
          },
        ];
  });
}

function rowOf(intention: Intention): IntentionRow {
  const data = countingData();
  const counted = countIntention(intention, data);
  const distribution = distributionOf(mixOwnerOf(intention, database.intentions));
  const reading = mixReadingOf(intention, distribution, counted, data);
  const target = {
    intention,
    plannedPages: counted.plannedPages,
    deliveredPages: counted.deliveredPages,
    today: today(),
  };
  const state = intentionStateOf(intention, today());
  const timeElapsed = intentionTimeElapsedOf(intention, today());
  const { funding, scopeCategoryId } = intention;
  const project =
    funding.kind === "project"
      ? database.projects.find((candidate) => candidate.id === funding.projectId)
      : undefined;
  const mixRows: MixRowView[] = reading.rows.map((row) => ({
    ...row,
    name: categoryName(row.categoryId),
  }));
  const fill: FillRowView[] =
    intention.targetPages === null
      ? []
      : fillOf(intention, distribution, counted, data).map((row) => ({
          ...row,
          path: pathWithin(scopeCategoryId, row.categoryId),
        }));
  return {
    intention,
    state,
    timeElapsed,
    daysToStart: Math.max(0, daysUntil(intention.countsFrom, today())),
    daysLeft:
      intention.endsOn === null ? null : Math.max(0, daysUntil(intention.endsOn, today()) + 1),
    evenPace: state === "Running" && intention.targetPages !== null ? timeElapsed : null,
    verdict: targetVerdictOf(target),
    pagesPerWeekNeeded: pagesPerWeekNeededOf(target),
    catchUpPages: catchUpPagesOf(target),
    plannedPages: counted.plannedPages,
    deliveredPages: counted.deliveredPages,
    outputPages: counted.outputPages,
    noDateCount: counted.noDateCount,
    noPagesCount: counted.noPagesCount,
    project: project === undefined ? null : { id: project.id, name: project.name },
    scope:
      scopeCategoryId === null
        ? null
        : { id: scopeCategoryId, path: pathWithin(null, scopeCategoryId) },
    mix: mixOf(intention),
    mixRows,
    unallocated: reading.unallocated,
    outOfBandCount: reading.outOfBandCount,
    fill,
    lists: listsOf(counted.planned),
  };
}

function templateRowOf(template: IntentionTemplate): IntentionTemplateRow {
  const tracked = database.intentions.find((candidate) => candidate.id === template.tracksMixOf);
  return {
    template,
    tracks: tracked === undefined ? null : { id: tracked.id, name: tracked.name },
  };
}

export function queryIntentionIndex(session: Session): IntentionIndex {
  return {
    rows: database.intentions.filter((intention) => isVisible(session, intention)).map(rowOf),
    // A repeat makes intentions only `any` reaches.
    templates: can(session, "intention.read", { kind: "unscoped" })
      ? database.intentionTemplates.map(templateRowOf)
      : [],
  };
}

// ---------------------------------------------------------------- acts

const notFound: Refusal = { status: 404, message: "Intention not found" };
const overallRefusal: Refusal = {
  status: 409,
  message: "The Overall intention cannot be archived or deleted",
  code: "intention.overall",
};

function intentionFor(session: Session, intentionId: string): Outcome<Intention> {
  const intention = database.intentions.find((candidate) => candidate.id === intentionId);
  if (intention === undefined || !isVisible(session, intention)) {
    return { refusal: notFound };
  }

  if (!can(session, "intention.edit", scopeOf(intention))) {
    return { refusal: { status: 403, message: "You may not change this intention" } };
  }

  return { value: intention };
}

function replaceIntention(intention: Intention): void {
  const index = database.intentions.findIndex((candidate) => candidate.id === intention.id);
  database.intentions.splice(index, 1, intention);
}

// The mix a choice would read, without storing anything.
function mixChosen(intention: Intention | null, choice: MixChoice): Distribution | null {
  if (choice.kind === "keep") {
    return intention === null ? null : distributionOf(mixOwnerOf(intention, database.intentions));
  }

  const owner = ownerFor(choice.kind === "track" ? choice.ownerId : choice.fromId);
  return owner === null ? null : distributionOf(owner);
}

// What the editor says before saving (§2.2, §3): the counts over the draft's whole window, and
// its mix within the draft's scope beside the one it reads now.
export function previewIntention(
  session: Session,
  request: IntentionPreviewRequest,
): Outcome<IntentionPreview> {
  if (!can(session, "intention.edit")) {
    return { refusal: { status: 403, message: "You may not change intentions" } };
  }

  const intention =
    request.intentionId === null
      ? null
      : (database.intentions.find((candidate) => candidate.id === request.intentionId) ?? null);
  const counted = countIntention(
    {
      ...overallIntention(),
      ...request,
      id: "draft",
      isOverall: false,
      targetPages: null,
    },
    countingData(),
  );
  const before =
    intention === null ? null : distributionOf(mixOwnerOf(intention, database.intentions));
  const after = mixChosen(intention, request.mix);
  const shareOf = (distribution: Distribution | null, categoryId: string) =>
    distribution === null
      ? null
      : shareWithinOf(database.categories, distribution, request.scopeCategoryId, categoryId);
  return {
    value: {
      plannedPages: counted.plannedPages,
      deliveredPages: counted.deliveredPages,
      outputPages: counted.outputPages,
      mix: mixCategoriesOf(database.categories, request.scopeCategoryId).map((category) => ({
        categoryId: category.id,
        name: category.name,
        before: shareOf(before, category.id),
        after: shareOf(after, category.id),
      })),
    },
  };
}

// Funding and category both exist, and the caller may edit what the draft would be.
function scopeRefusal(session: Session, draft: IntentionScope): Refusal | null {
  const { funding } = draft;
  if (
    funding.kind === "project" &&
    !database.projects.some((project) => project.id === funding.projectId)
  ) {
    return { status: 422, message: `No project ${funding.projectId}` };
  }

  if (
    draft.scopeCategoryId !== null &&
    !database.categories.some((category) => category.id === draft.scopeCategoryId)
  ) {
    return { status: 422, message: `No category ${draft.scopeCategoryId}` };
  }

  const reach = scopeOf({ funding });
  return can(session, "intention.edit", reach)
    ? null
    : { status: 403, message: "You may not set an intention for that funding" };
}

function nameRefusal(name: string, intentionId: string | null): Refusal | null {
  const isTaken = database.intentions.some(
    (candidate) =>
      candidate.id !== intentionId && candidate.name.toLowerCase() === name.toLowerCase(),
  );
  return isTaken
    ? { status: 422, message: "Another intention already has that name", code: "intention.name" }
    : null;
}

// An intention another can track: one that owns its mix (§2, no chains).
function ownerFor(ownerId: string): Intention | null {
  const owner = database.intentions.find((candidate) => candidate.id === ownerId);
  return owner === undefined || owner.tracksMixOf !== null ? null : owner;
}

const chainRefusal: Refusal = {
  status: 422,
  message: "Track or copy only an intention that owns its mix",
  code: "intention.not_owner",
};

function nextId(prefix: string, ids: readonly string[]): string {
  const numbers = ids.map((id) => Number(id.slice(prefix.length)) || 0);
  return `${prefix}${Math.max(0, ...numbers) + 1}`;
}

function copyMixOf(owner: Intention, ownerId: string): Distribution {
  const copy: Distribution = {
    id: nextId(
      "d",
      database.distributions.map((distribution) => distribution.id),
    ),
    ownerId,
    shares: { ...distributionOf(owner).shares },
    revision: 1,
  };
  database.distributions.push(copy);
  return copy;
}

// The mix choice applied (§2.1–§2.2), or why it cannot be. Returns what to store on the
// intention, and the trackers and repeats that move with it.
function applyMix(
  session: Session,
  intention: Intention,
  draft: IntentionDraft,
  isNew: boolean,
): Outcome<Pick<Intention, "tracksMixOf" | "distributionId">> {
  const { mix } = draft;
  if (mix.kind === "keep") {
    return !isNew && intention.tracksMixOf === null
      ? { value: { tracksMixOf: null, distributionId: intention.distributionId } }
      : { refusal: { status: 422, message: "It has no mix of its own to keep" } };
  }

  if (mix.kind === "copy") {
    const source = ownerFor(mix.fromId);
    if (source === null) {
      return { refusal: chainRefusal };
    }

    const copy = copyMixOf(source, intention.id);
    // Those tracking it read its mix, so they follow it onto the copy.
    for (const tracker of isNew ? [] : trackersOf(intention, database.intentions)) {
      replaceIntention({ ...tracker, distributionId: copy.id });
    }

    return { value: { tracksMixOf: null, distributionId: copy.id } };
  }

  const owner = ownerFor(mix.ownerId);
  if (owner === null || owner.id === intention.id) {
    return { refusal: chainRefusal };
  }

  const trackers = isNew ? [] : trackersOf(intention, database.intentions);
  if (trackers.length > 0 && !mix.isMovingTrackers) {
    return {
      refusal: {
        status: 409,
        message: "Others track its mix: move them along, or keep its own mix",
        code: "intention.tracked",
      },
    };
  }

  if (trackers.some((tracker) => !can(session, "intention.edit", scopeOf(tracker)))) {
    return {
      refusal: { status: 403, message: "You may not change every intention that tracks it" },
    };
  }

  for (const tracker of trackers) {
    replaceIntention({ ...tracker, tracksMixOf: owner.id, distributionId: owner.distributionId });
  }

  // A repeat tracking it would make a chain at its next occurrence, so it moves too.
  database.intentionTemplates = database.intentionTemplates.map((template) =>
    !isNew && template.tracksMixOf === intention.id
      ? { ...template, tracksMixOf: owner.id, distributionId: owner.distributionId }
      : template,
  );
  return { value: { tracksMixOf: owner.id, distributionId: owner.distributionId } };
}

const overallShapeRefusal: Refusal = {
  status: 422,
  message: "The Overall intention counts everything, with no target or end, and owns its mix",
};

export function createIntention(session: Session, draft: IntentionDraft): Outcome<IntentionRow> {
  const refusal = scopeRefusal(session, draft) ?? nameRefusal(draft.name, null);
  if (refusal !== null) {
    return { refusal };
  }

  const { mix: _mix, ...fields } = draft;
  const created: Intention = {
    ...fields,
    id: nextId(
      "i",
      database.intentions.map((intention) => intention.id),
    ),
    tracksMixOf: null,
    distributionId: overallIntention().distributionId,
    isOverall: false,
    templateId: null,
    archived: null,
  };
  const mix = applyMix(session, created, draft, true);
  if ("refusal" in mix) {
    return mix;
  }

  const intention = { ...created, ...mix.value };
  database.intentions.push(intention);
  return { value: rowOf(intention) };
}

// Editing scope or end recounts the whole window; the counting start never moves (§3).
export function saveIntention(
  session: Session,
  intentionId: string,
  draft: IntentionDraft,
): Outcome<IntentionRow> {
  const found = intentionFor(session, intentionId);
  if ("refusal" in found) {
    return found;
  }

  const intention = found.value;
  if (draft.countsFrom !== intention.countsFrom) {
    return {
      refusal: {
        status: 422,
        message: "The counting start is fixed once created; make a new intention from this one",
        code: "intention.counts_from",
      },
    };
  }

  const isOverallKept =
    draft.funding.kind === "any" &&
    draft.scopeCategoryId === null &&
    draft.targetPages === null &&
    draft.endsOn === null &&
    draft.mix.kind === "keep";
  if (intention.isOverall && !isOverallKept) {
    return { refusal: overallShapeRefusal };
  }

  const refusal = scopeRefusal(session, draft) ?? nameRefusal(draft.name, intention.id);
  if (refusal !== null) {
    return { refusal };
  }

  const mix = applyMix(session, intention, draft, false);
  if ("refusal" in mix) {
    return mix;
  }

  const { mix: _mix, ...fields } = draft;
  const saved: Intention = { ...intention, ...fields, ...mix.value };
  replaceIntention(saved);
  return { value: rowOf(saved) };
}

// Off the page only; it keeps counting (§3.3).
export function archiveIntention(session: Session, intentionId: string): Outcome<IntentionRow> {
  const found = intentionFor(session, intentionId);
  if ("refusal" in found) {
    return found;
  }

  const intention = found.value;
  if (intention.isOverall) {
    return { refusal: overallRefusal };
  }

  const archived: Intention = {
    ...intention,
    archived: intention.archived ?? {
      actor: { kind: "user", userId: session.user.id },
      at: new Date().toISOString(),
    },
  };
  replaceIntention(archived);
  return { value: rowOf(archived) };
}

export function unarchiveIntention(session: Session, intentionId: string): Outcome<IntentionRow> {
  const found = intentionFor(session, intentionId);
  if ("refusal" in found) {
    return found;
  }

  const unarchived: Intention = { ...found.value, archived: null };
  replaceIntention(unarchived);
  return { value: rowOf(unarchived) };
}

// TODO(rrandiak): deleting an intention others track is refused, since the sources do not say
// who would own the mix then (the §2.3 rule, "the longest tracker owns it", is for a shared mix
// edited, and the tracking start is not stored).
function deletableFor(session: Session, intentionId: string): Outcome<Intention> {
  const found = intentionFor(session, intentionId);
  if ("refusal" in found) {
    return found;
  }

  const intention = found.value;
  if (intention.isOverall) {
    return { refusal: overallRefusal };
  }

  const isTracked =
    trackersOf(intention, database.intentions).length > 0 ||
    database.intentionTemplates.some((template) => template.tracksMixOf === intention.id);
  if (isTracked) {
    return {
      refusal: {
        status: 409,
        message: "Others track its mix, so it stays; archive it instead",
        code: "intention.tracked",
      },
    };
  }

  return found;
}

export function previewIntentionDeletion(
  session: Session,
  intentionId: string,
): Outcome<IntentionDeletion> {
  const found = deletableFor(session, intentionId);
  if ("refusal" in found) {
    return found;
  }

  return {
    value: {
      generatedLists: database.lists
        .filter((list) => list.generated?.intentionId === intentionId)
        .map((list) => ({ id: list.id, name: list.name })),
    },
  };
}

// Nothing is attached, so no list or item changes; a generated list's provenance keeps it.
export function deleteIntention(session: Session, intentionId: string): Outcome<null> {
  const found = deletableFor(session, intentionId);
  if ("refusal" in found) {
    return found;
  }

  database.intentions = database.intentions.filter((intention) => intention.id !== intentionId);
  return { value: null };
}

// ---------------------------------------------------------------- repeats

function templateRefusal(session: Session, draft: IntentionTemplateDraft): Refusal | null {
  if (!can(session, "intention.repeat")) {
    return { status: 403, message: "You may not set repeats" };
  }

  const scope = { ...draft, countsFrom: today(), endsOn: null };
  return ownerFor(draft.tracksMixOf) === null ? chainRefusal : scopeRefusal(session, scope);
}

// Its first occurrence is made when the next period starts.
export function createIntentionTemplate(
  session: Session,
  draft: IntentionTemplateDraft,
): Outcome<IntentionTemplateRow> {
  const refusal = templateRefusal(session, draft);
  if (refusal !== null) {
    return { refusal };
  }

  const template: IntentionTemplate = {
    ...draft,
    id: nextId(
      "t",
      database.intentionTemplates.map((candidate) => candidate.id),
    ),
    distributionId: distributionOf(ownerFor(draft.tracksMixOf) ?? overallIntention()).id,
    since: today(),
    nextOn: nextPeriodStartOf(draft.every, today()),
    createdBy: session.user.id,
  };
  database.intentionTemplates.push(template);
  return { value: templateRowOf(template) };
}

// From the next occurrence on; those already made keep their definition (§3.3).
export function saveIntentionTemplate(
  session: Session,
  templateId: string,
  draft: IntentionTemplateDraft,
): Outcome<IntentionTemplateRow> {
  const template = database.intentionTemplates.find((candidate) => candidate.id === templateId);
  if (template === undefined) {
    return { refusal: { status: 404, message: "Repeat not found" } };
  }

  const refusal = templateRefusal(session, draft);
  if (refusal !== null) {
    return { refusal };
  }

  const saved: IntentionTemplate = {
    ...template,
    ...draft,
    distributionId: distributionOf(ownerFor(draft.tracksMixOf) ?? overallIntention()).id,
    nextOn:
      draft.every === template.every ? template.nextOn : nextPeriodStartOf(draft.every, today()),
  };
  database.intentionTemplates = database.intentionTemplates.map((candidate) =>
    candidate.id === templateId ? saved : candidate,
  );
  return { value: templateRowOf(saved) };
}
