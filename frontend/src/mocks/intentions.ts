// What the server does for Intentions (intentions.md): keep intentions to the caller's reach,
// count each one by the rules of `domain/intentions.ts` against the lists and iterations as they
// are now, and resolve whose mix each reads. `intention.read@project` reaches an intention a
// project the caller is on funds; every other intention only `any` reaches (permissions.md §3).
// A repeat's occurrences are fixtures; the mock makes no new ones.

import type {
  FillRowView,
  IntentionIndex,
  IntentionList,
  IntentionMix,
  IntentionRow,
  IntentionTemplateRow,
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
  mixOwnerOf,
  mixReadingOf,
  pagesPerWeekNeededOf,
  targetVerdictOf,
  trackersOf,
} from "@/domain/intentions";
import type { ScopedRecord } from "@/domain/permissions";
import { can } from "@/domain/permissions";
import { daysUntil, scopeOfProject } from "@/domain/projects";
import { dayOf } from "@/lib/value-range";
import { database } from "@/mocks/database";
import { mockToday } from "@/mocks/today";

const today = () => dayOf(mockToday);

// ---------------------------------------------------------------- reach

export function canReadIntentions(session: Session): boolean {
  return can(session, "intention.read");
}

function scopeOfIntention(intention: Intention): ScopedRecord {
  const { funding } = intention;
  const project =
    funding.kind === "project"
      ? database.projects.find((candidate) => candidate.id === funding.projectId)
      : undefined;
  return project === undefined ? { kind: "unscoped" } : scopeOfProject(project);
}

function isVisible(session: Session, intention: Intention): boolean {
  return can(session, "intention.read", scopeOfIntention(intention));
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
