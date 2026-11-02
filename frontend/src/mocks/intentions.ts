// What the server does for Intentions: keep intentions to the caller's reach, count each one by
// `domain/intentions.ts`, read its optional mix, and preserve its displayed result at Archive.
// `intention.read@project` reaches an intention a
// project the caller is on funds; every other intention only `any` reaches (permissions.md §3).
// An intention chooses a mix directly, none, the Primary mix or a mix any number of others use too
// (PLAN-mix, PLAN-no-mix). All of it is `intention.edit` on the intention changed, a repeat
// `intention.repeat`. A repeat's occurrences are fixtures; the mock makes no new ones.
// A project's own intention (§3.4) is listed once its project is decided; its name, funding,
// window and target are the project's, changed on Projects, and it is never archived or deleted
// on its own.

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
} from "@vera/contract/intentions";
import { categoryPathOf, isInSubtree, leafCategoriesOf } from "@vera/domain/categories";
import { effectivePageCount } from "@vera/domain/documents";
import type {
  Distribution,
  Intention,
  IntentionTemplate,
  Iteration,
  Session,
} from "@vera/domain/entities";
import type { CountingData } from "@vera/domain/intentions";
import {
  catchUpPagesOf,
  countIntention,
  fillOf,
  intentionStateOf,
  intentionTimeElapsedOf,
  mixCategoriesOf,
  mixReadingOf,
  nextPeriodStartOf,
  pagesPerWeekNeededOf,
  scopeOfIntention,
  shareWithinOf,
  targetVerdictOf,
} from "@vera/domain/intentions";
import { can } from "@vera/domain/permissions";
import { daysUntil } from "@vera/domain/projects";
import { dayOf } from "@vera/domain/value-range";
import { database } from "@/mocks/database";
import { mixTreeOf } from "@/mocks/mixes";
import type { Outcome, Refusal } from "@/mocks/mutations";
import { allPropertyDefinitions, meetsScopeConditions } from "@/mocks/properties";
import { mockToday } from "@/mocks/today";

const today = () => dayOf(mockToday);

// ---------------------------------------------------------------- reach

export function canReadIntentions(session: Session): boolean {
  return can(session, "intention.read");
}

const scopeOf = (intention: Pick<Intention, "funding">) =>
  scopeOfIntention(intention, database.projects);

// A project's own intention is listed once the project is decided: Approved, or archived with a
// Rejected one (§3.4).
function isListed(intention: Pick<Intention, "projectId">): boolean {
  const project = database.projects.find((candidate) => candidate.id === intention.projectId);
  return project === undefined || project.state !== "Proposed";
}

export function isVisible(session: Session, intention: Intention): boolean {
  return isListed(intention) && can(session, "intention.read", scopeOf(intention));
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
    meetsConditions: meetsScopeConditions,
  };
}

// The mix the intention reads, which is its owner's.
export function distributionOf(
  intention: Pick<Intention, "distributionId"> & { mixRevision?: number | null },
): Distribution {
  const distribution = database.distributions.find(
    (candidate) => candidate.id === intention.distributionId,
  );
  if (distribution === undefined) {
    throw new Error(`No mix ${intention.distributionId}`);
  }

  if (intention.mixRevision === undefined || intention.mixRevision === null) {
    return distribution;
  }

  const revision = distribution.revisions.find(
    (candidate) => candidate.revision === intention.mixRevision,
  );
  if (revision === undefined) {
    throw new Error(`No revision ${intention.mixRevision} of mix ${distribution.id}`);
  }

  return { ...distribution, shares: revision.shares, revision: revision.revision };
}

export function overallIntention(): Intention {
  const overall = database.intentions.find((intention) => intention.isOverall);
  if (overall === undefined) {
    throw new Error("No Overall intention");
  }

  return overall;
}

function mixOf(intention: Intention): IntentionMix | null {
  if (intention.distributionId === null) return null;
  const distribution = distributionOf(intention);
  return { id: distribution.id, name: distribution.name, revision: distribution.revision };
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

function liveRowOf(intention: Intention): IntentionRow {
  const data = countingData();
  const counted = countIntention(intention, data);
  const distribution = intention.distributionId === null ? null : distributionOf(intention);
  const reading =
    distribution === null ? null : mixReadingOf(intention, distribution, counted, data);
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
  const outputRows = mixCategoriesOf(database.categories, intention.scopeCategoryId);
  const sumPages = (items: readonly Iteration[], categoryId: string) =>
    items
      .filter((item) => isInSubtree(database.categories, item.categoryId, categoryId))
      .reduce((sum, item) => sum + (pagesOf(item) ?? 0), 0);
  const mixRows: MixRowView[] =
    reading === null
      ? outputRows.map((category) => ({
          categoryId: category.id,
          name: category.name,
          intended: null,
          planned:
            counted.plannedPages === 0
              ? null
              : (100 * sumPages(counted.planned, category.id)) / counted.plannedPages,
          output:
            counted.outputPages === 0
              ? null
              : (100 * sumPages(counted.output, category.id)) / counted.outputPages,
          outputPages: sumPages(counted.output, category.id),
          drift: null,
          flag: null,
        }))
      : reading.rows.map((row) => ({ ...row, name: categoryName(row.categoryId) }));
  const fill: FillRowView[] =
    intention.targetPages === null
      ? []
      : distribution === null
        ? leafCategoriesOf(database.categories)
            .filter(
              (leaf) =>
                intention.scopeCategoryId === null ||
                isInSubtree(database.categories, leaf.id, intention.scopeCategoryId),
            )
            .map((leaf) => ({
              categoryId: leaf.id,
              path: pathWithin(scopeCategoryId, leaf.id),
              share: null,
              targetPages: null,
              plannedPages: sumPages(counted.planned, leaf.id),
              deliveredPages: sumPages(counted.delivered, leaf.id),
              isShort: false,
            }))
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
    unallocated: reading?.unallocated ?? 0,
    outOfBandCount: reading?.outOfBandCount ?? 0,
    fill,
    lists: listsOf(counted.planned),
  };
}

function rowOf(intention: Intention): IntentionRow {
  if (intention.archived === null) return liveRowOf(intention);
  const preserved = database.archivedIntentionRows[intention.id];
  if (preserved !== undefined) return preserved;
  // Seeded archives get a capture on first read. Subsequent work cannot change that capture.
  const captured = structuredClone(liveRowOf(intention));
  database.archivedIntentionRows[intention.id] = captured;
  if (intention.distributionId !== null)
    database.archivedIntentionMixes[intention.id] = structuredClone(mixTreeOf(intention));
  database.archivedIntentionCategories[intention.id] = structuredClone(database.categories);
  return captured;
}

export function preserveIntentionArchive(intention: Intention): IntentionRow {
  const pinned = {
    ...intention,
    mixRevision: intention.distributionId === null ? null : distributionOf(intention).revision,
  };
  replaceIntention(pinned);
  const captured = structuredClone(liveRowOf(pinned));
  database.archivedIntentionRows[pinned.id] = captured;
  if (pinned.distributionId !== null)
    database.archivedIntentionMixes[pinned.id] = structuredClone(mixTreeOf(pinned));
  database.archivedIntentionCategories[pinned.id] = structuredClone(database.categories);
  return captured;
}

function templateRowOf(template: IntentionTemplate): IntentionTemplateRow {
  const mix = database.distributions.find((candidate) => candidate.id === template.distributionId);
  return { template, mix: mix === undefined ? null : { id: mix.id, name: mix.name } };
}

export function queryIntentionIndex(session: Session): IntentionIndex {
  return {
    asOf: dayOf(mockToday),
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

// The project's own: its name, funding, window and target are the project's.
const projectRefusal: Refusal = {
  status: 409,
  message: "It is its project's intention: it changes, and goes, with the project",
  code: "intention.project",
};

export function intentionFor(session: Session, intentionId: string): Outcome<Intention> {
  const intention = database.intentions.find((candidate) => candidate.id === intentionId);
  if (intention === undefined || !isVisible(session, intention)) {
    return { refusal: notFound };
  }

  if (!can(session, "intention.edit", scopeOf(intention))) {
    return { refusal: { status: 403, message: "You may not change this intention" } };
  }

  return { value: intention };
}

export function replaceIntention(intention: Intention): void {
  if (intention.distributionId !== null) database.mixUsedIds.add(intention.distributionId);
  const index = database.intentions.findIndex((candidate) => candidate.id === intention.id);
  database.intentions.splice(index, 1, intention);
}

// The mix a choice would read, without storing anything.
function mixChosen(choice: MixChoice): Distribution | null {
  if (choice.kind === "none") return null;
  if (choice.kind === "primary")
    return database.distributions.find((mix) => mix.isPrimary && mix.archivedAt === null) ?? null;
  const selected = database.distributions.find((mix) => mix.id === choice.mixId);
  return selected === undefined
    ? null
    : distributionOf({ distributionId: selected.id, mixRevision: choice.revision });
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
    intention === null || intention.distributionId === null ? null : distributionOf(intention);
  const after = mixChosen(request.mix);
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
    return { status: 422, code: "intention.project", message: `No project ${funding.projectId}` };
  }

  if (
    draft.scopeCategoryId !== null &&
    !database.categories.some((category) => category.id === draft.scopeCategoryId)
  ) {
    return {
      status: 422,
      code: "category.not_found",
      message: `No category ${draft.scopeCategoryId}`,
    };
  }

  // PLAN-scope: a condition names a property that exists.
  const keys = new Set(allPropertyDefinitions().map(({ key }) => key));
  const unknown = (draft.scopeConditions ?? []).find((condition) => !keys.has(condition.key));
  if (unknown !== undefined) {
    return { status: 422, code: "property.not_found", message: `No property ${unknown.key}` };
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

export function nextId(prefix: string, ids: readonly string[]): string {
  const numbers = ids.map((id) => Number(id.slice(prefix.length)) || 0);
  return `${prefix}${Math.max(0, ...numbers) + 1}`;
}

// The mix choice applied (PLAN-mix, PLAN-no-mix), or why it cannot be: what to store on the
// intention.
function applyMix(
  draft: IntentionDraft,
): Outcome<Pick<Intention, "distributionId" | "mixRevision">> {
  const { mix } = draft;
  if (mix.kind === "none") {
    return { value: { distributionId: null, mixRevision: null } };
  }
  if (mix.kind === "primary") {
    const selected = database.distributions.find(
      (candidate) => candidate.isPrimary && candidate.archivedAt === null,
    );
    return selected === undefined
      ? {
          refusal: {
            status: 409,
            code: "mix.no_primary",
            message: "No active Primary mix",
          },
        }
      : { value: { distributionId: selected.id, mixRevision: null } };
  }
  const selected = database.distributions.find((candidate) => candidate.id === mix.mixId);
  if (selected === undefined || selected.archivedAt !== null)
    return {
      refusal: {
        status: 422,
        code: "intention.mix_inactive",
        message: "Choose an active mix",
      },
    };
  if (
    mix.revision !== null &&
    !selected.revisions.some((candidate) => candidate.revision === mix.revision)
  )
    return {
      refusal: {
        status: 422,
        code: "intention.revision_required",
        message: "Choose a saved revision",
      },
    };
  return { value: { distributionId: mix.mixId, mixRevision: mix.revision } };
}

const overallShapeRefusal: Refusal = {
  status: 422,
  code: "intention.overall_has_no_target",
  message: "Overall counts everything, with no target or end",
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
    // A project's own intention is made only with the project.
    projectId: null,
    distributionId: overallIntention().distributionId,
    isOverall: false,
    templateId: null,
    archived: null,
  };
  const mix = applyMix(draft);
  if ("refusal" in mix) {
    return mix;
  }

  const intention = { ...created, ...mix.value };
  database.intentions.push(intention);
  if (intention.distributionId !== null) database.mixUsedIds.add(intention.distributionId);
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
  if (intention.archived !== null) {
    return {
      refusal: {
        status: 409,
        code: "intention.is_archived",
        message: "An archived intention is preserved; copy it to make changes",
      },
    };
  }
  if (draft.countsFrom !== intention.countsFrom) {
    return {
      refusal: {
        status: 422,
        message: "The counting start is fixed once created; make a new intention from this one",
        code: "intention.counts_from",
      },
    };
  }

  const isProjectKept =
    draft.name === intention.name &&
    isSameFunding(draft.funding, intention.funding) &&
    draft.endsOn === intention.endsOn &&
    draft.targetPages === intention.targetPages;
  if (intention.projectId !== null && !isProjectKept) {
    return { refusal: projectRefusal };
  }

  const isOverallKept =
    draft.funding.kind === "any" &&
    draft.scopeCategoryId === null &&
    (draft.scopeConditions ?? []).length === 0 &&
    draft.targetPages === null &&
    draft.endsOn === null;
  if (intention.isOverall && !isOverallKept) {
    return { refusal: overallShapeRefusal };
  }

  const refusal = scopeRefusal(session, draft) ?? nameRefusal(draft.name, intention.id);
  if (refusal !== null) {
    return { refusal };
  }

  const mix = applyMix(draft);
  if ("refusal" in mix) {
    return mix;
  }

  const { mix: _mix, ...fields } = draft;
  const saved: Intention = { ...intention, ...fields, ...mix.value };
  replaceIntention(saved);
  return { value: rowOf(saved) };
}

function isSameFunding(first: Intention["funding"], second: Intention["funding"]): boolean {
  return (
    first.kind === second.kind &&
    (first.kind !== "project" || second.kind !== "project" || first.projectId === second.projectId)
  );
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

  if (intention.projectId !== null) {
    return { refusal: projectRefusal };
  }

  const archived: Intention = {
    ...intention,
    archived: intention.archived ?? {
      actor: { kind: "user", userId: session.user.id },
      at: new Date().toISOString(),
    },
  };
  return { value: preserveIntentionArchive(archived) };
}

export function unarchiveIntention(session: Session, intentionId: string): Outcome<IntentionRow> {
  const found = intentionFor(session, intentionId);
  if ("refusal" in found) {
    return found;
  }

  if (found.value.projectId !== null) {
    return { refusal: projectRefusal };
  }

  return {
    refusal: {
      status: 409,
      code: "intention.is_archived",
      message: "An archive is preserved; create a copy for new work",
    },
  };
}

// Its mix is its own record (PLAN-mix), so nothing else holds it back.
function deletableFor(session: Session, intentionId: string): Outcome<Intention> {
  const found = intentionFor(session, intentionId);
  if ("refusal" in found) {
    return found;
  }

  const intention = found.value;
  if (intention.archived !== null) {
    return {
      refusal: {
        status: 409,
        code: "intention.is_archived",
        message: "An archived intention is preserved",
      },
    };
  }
  if (intention.isOverall) {
    return { refusal: overallRefusal };
  }

  if (intention.projectId !== null) {
    return { refusal: projectRefusal };
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
  if (draft.mix.kind === "use") {
    const chosen = draft.mix;
    const selected = database.distributions.find(
      (mix) => mix.id === chosen.mixId && mix.archivedAt === null,
    );
    if (
      selected === undefined ||
      (chosen.revision !== null &&
        !selected.revisions.some((version) => version.revision === chosen.revision))
    )
      return {
        status: 422,
        code: "intention.mix_revision_required",
        message: "Choose an active mix and saved revision",
      };
  }
  return scopeRefusal(session, scope);
}

function templateMixOf(
  draft: IntentionTemplateDraft,
): Pick<IntentionTemplate, "distributionId" | "mixRevision"> {
  if (draft.mix.kind === "use")
    return { distributionId: draft.mix.mixId, mixRevision: draft.mix.revision };
  return {
    distributionId:
      draft.mix.kind === "primary"
        ? (database.distributions.find((mix) => mix.isPrimary && mix.archivedAt === null)?.id ??
          null)
        : null,
    mixRevision: null,
  };
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
    ...templateMixOf(draft),
    id: nextId(
      "t",
      database.intentionTemplates.map((candidate) => candidate.id),
    ),
    since: today(),
    nextOn: nextPeriodStartOf(draft.every, today()),
    createdBy: session.user.id,
  };
  database.intentionTemplates.push(template);
  if (template.distributionId !== null) database.mixUsedIds.add(template.distributionId);
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
    ...templateMixOf(draft),
    nextOn:
      draft.every === template.every ? template.nextOn : nextPeriodStartOf(draft.every, today()),
  };
  database.intentionTemplates = database.intentionTemplates.map((candidate) =>
    candidate.id === templateId ? saved : candidate,
  );
  if (saved.distributionId !== null) database.mixUsedIds.add(saved.distributionId);
  return { value: templateRowOf(saved) };
}
