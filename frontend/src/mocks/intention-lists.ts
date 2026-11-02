// Where intentions meet lists, as the server works it out (intentions.md §4–§5): what a list
// counts towards from what is on it and when it starts, never attached; its fill read against
// one intention's mix inside its scope; the intentions a draft can be shaped by; and the
// allocation a correcting run would hand to the list editor. A member cancelled before it was
// digitized no longer counts, as in the intention's own planned figure.

import type { CorrectionPreview } from "@vera/contract/intentions";
import type {
  CountsTowardsRow,
  ListMix,
  ListReading,
  ListReadingRequest,
  ListShape,
} from "@vera/contract/lists";
import { categoryLineageOf } from "@vera/domain/categories";
import type { DigitizationList, Intention, Iteration, Session } from "@vera/domain/entities";
import {
  correctionOf,
  countIntention,
  countsTowardsOf,
  isInIntentionScope,
  listMixOf,
  mixReadingOf,
} from "@vera/domain/intentions";
import { isInPool } from "@vera/domain/lists";
import { hasPermission } from "@vera/domain/permissions";
import { isProgressAtLeast } from "@vera/domain/status";
import { dayOf } from "@vera/domain/value-range";
import { database } from "@/mocks/database";
import { countingData, distributionOf, overallIntention } from "@/mocks/intentions";
import type { Outcome, Refusal } from "@/mocks/mutations";
import { mockToday } from "@/mocks/today";

const today = () => dayOf(mockToday);

const categoryName = (categoryId: string | null) =>
  categoryId === null
    ? null
    : (database.categories.find((category) => category.id === categoryId)?.name ?? categoryId);

const isCounting = (iteration: Iteration) =>
  iteration.cancellation === null || isProgressAtLeast(iteration.progress, "Digitized");

export function countingMembersOf(listId: string): Iteration[] {
  return database.iterations.filter(
    (iteration) => iteration.listId === listId && isCounting(iteration),
  );
}

const pagesOf = (iteration: Iteration) => countingData().pagesOf(iteration);

// Overall last: it counts everything, so it says the least.
export function countsTowardsRowsOf(
  members: readonly Iteration[],
  startsOn: string,
): CountsTowardsRow[] {
  return countsTowardsOf(database.intentions, members, startsOn, countingData())
    .toSorted(
      (first, second) => Number(first.intention.isOverall) - Number(second.intention.isOverall),
    )
    .map(({ intention, itemCount, pages }) => ({
      intentionId: intention.id,
      name: intention.name,
      isOverall: intention.isOverall,
      itemCount,
      pages,
    }));
}

export function generatedWithOf(list: DigitizationList): Intention | null {
  const intentionId = list.generated?.intentionId;
  return database.intentions.find((intention) => intention.id === intentionId) ?? null;
}

export function listMixFor(
  members: readonly Iteration[],
  intention: Intention,
  targetPages: number | null,
  allocation: Readonly<Record<string, number>> | null,
): ListMix {
  if (intention.distributionId === null)
    return {
      intention: { id: intention.id, name: intention.name },
      scope: categoryName(intention.scopeCategoryId),
      isAllocation: false,
      rows: [],
    };
  const distribution = distributionOf(intention);
  return {
    intention: { id: intention.id, name: intention.name },
    scope: categoryName(intention.scopeCategoryId),
    isAllocation: allocation !== null,
    rows: listMixOf(
      intention,
      distribution,
      members,
      { targetPages, allocation },
      countingData(),
    ).map((row) => ({ ...row, name: categoryName(row.categoryId) ?? row.categoryId })),
  };
}

// Read against what it was generated with, with the allocation it accepted; else Overall.
export function savedListMixOf(list: DigitizationList): ListMix {
  const generatedWith = generatedWithOf(list);
  const basedOn = generatedWith ?? overallIntention();
  const captured = list.generated;
  const selected =
    captured === null || captured === undefined
      ? basedOn
      : {
          ...basedOn,
          distributionId: captured.mixId === undefined ? basedOn.distributionId : captured.mixId,
          mixRevision:
            captured.mixRevision !== null &&
            database.distributions.some(
              (mix) =>
                mix.id === (captured.mixId ?? basedOn.distributionId) &&
                mix.revisions.some((version) => version.revision === captured.mixRevision),
            )
              ? captured.mixRevision
              : null,
        };
  return listMixFor(
    countingMembersOf(list.id),
    selected,
    list.targetPages,
    generatedWith === null ? null : (list.generated?.allocation ?? null),
  );
}

// ---------------------------------------------------------------- the editor

export function canBuildWithIntentions(session: Session): boolean {
  return hasPermission(session, "list.create") || hasPermission(session, "list.edit");
}

const mayNotBuild: Refusal = { status: 403, message: "You may not build lists" };

// Not archived and not ended; Overall first (page-lists.js `shapeable`).
export function shapeableIntentions(): Intention[] {
  return database.intentions
    .filter(
      (intention) =>
        intention.archived === null && (intention.endsOn === null || intention.endsOn >= today()),
    )
    .toSorted((first, second) => Number(second.isOverall) - Number(first.isOverall));
}

export function listShapes(session: Session): Outcome<ListShape[]> {
  if (!canBuildWithIntentions(session)) {
    return { refusal: mayNotBuild };
  }

  return {
    value: shapeableIntentions().map((intention) => {
      const { funding } = intention;
      const project =
        funding.kind === "project"
          ? database.projects.find((candidate) => candidate.id === funding.projectId)
          : undefined;
      return {
        id: intention.id,
        name: intention.name,
        isOverall: intention.isOverall,
        countsFrom: intention.countsFrom,
        endsOn: intention.endsOn,
        scope: categoryName(intention.scopeCategoryId),
        funding:
          funding.kind === "project"
            ? { kind: "project", name: project?.name ?? funding.projectId }
            : funding,
      };
    }),
  };
}

export function readList(session: Session, request: ListReadingRequest): Outcome<ListReading> {
  if (!canBuildWithIntentions(session)) {
    return { refusal: mayNotBuild };
  }

  const intention =
    request.intentionId === null
      ? overallIntention()
      : database.intentions.find((candidate) => candidate.id === request.intentionId);
  if (intention === undefined) {
    return {
      refusal: {
        status: 422,
        code: "list.intention_not_found",
        message: `No intention ${request.intentionId}`,
      },
    };
  }

  const memberIds = new Set(request.memberIds);
  const members = database.iterations.filter(
    (iteration) => memberIds.has(iteration.id) && isCounting(iteration),
  );
  const startsOn = request.startsOn ?? today();
  const countsTowards = countsTowardsRowsOf(members, startsOn);
  const saved = database.lists.find((list) => list.id === request.listId);
  const before = saved === undefined ? [] : countsTowardsRowsOf(members, saved.startsOn);
  return {
    value: {
      startsOn,
      countsTowards,
      stopsCountingTowards: before
        .filter((row) => !countsTowards.some((now) => now.intentionId === row.intentionId))
        .map((row) => ({ id: row.intentionId, name: row.name })),
      mix: listMixFor(members, intention, request.targetPages, request.allocation),
    },
  };
}

// ---------------------------------------------------------------- a correcting run

// What a correcting list of so many pages would take per category, shown before anything is
// generated (STATUS "Intentions"): supply is what is ready within the intention's scope.
export function previewCorrection(
  session: Session,
  intentionId: string,
  pages: number,
): Outcome<CorrectionPreview> {
  if (!canBuildWithIntentions(session)) {
    return { refusal: mayNotBuild };
  }

  const intention = shapeableIntentions().find((candidate) => candidate.id === intentionId);
  if (intention === undefined) {
    return {
      refusal: {
        status: 404,
        code: "list.intention_not_found",
        message: "No intention to correct towards",
      },
    };
  }
  if (intention.distributionId === null) {
    return {
      refusal: {
        status: 422,
        code: "list.correction_needs_mix",
        message: "This intention has no mix to correct towards",
      },
    };
  }

  const data = countingData();
  const counted = countIntention(intention, data);
  const distribution = distributionOf(intention);
  const reading = mixReadingOf(intention, distribution, counted, data);
  const pool = database.iterations.filter(
    (iteration) =>
      isInPool(iteration) &&
      isInIntentionScope(intention, iteration, data.categories, data.meetsConditions),
  );
  const readyPagesOf = (categoryId: string) =>
    pool
      .filter((iteration) =>
        categoryLineageOf(data.categories, iteration.categoryId).includes(categoryId),
      )
      .reduce((sum, iteration) => sum + (pagesOf(iteration) ?? 0), 0);
  const correction = correctionOf({
    rows: reading.rows,
    outputPages: counted.outputPages,
    pages,
    readyPagesOf,
  });
  return {
    value: {
      outputPages: counted.outputPages,
      pages,
      isCut: correction.isCut,
      unallocated: reading.unallocated,
      rows: correction.rows.map((row, index) => {
        const reads = reading.rows[index];
        return {
          ...row,
          name: categoryName(row.categoryId) ?? row.categoryId,
          intended: reads?.intended ?? null,
          output: reads?.output ?? null,
        };
      }),
    },
  };
}
