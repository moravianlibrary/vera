// What the server does when someone changes a document's current iteration from the Documents or
// Validations pane: reclassify it (C6,
// V13), set where its scan is available (P1), enter its page count, recheck it against the
// catalog, cancel and resume it, and overrule its restriction. Each checks its permission against the iteration's category,
// refuses what the iteration's state does not allow, and writes the status log. Entering a
// page count runs the checks again, and a recheck runs them over the record as the catalog has
// it now; a defect they no longer find needs no verdict, and the gates move progress
// (flows.md V14).

import type {
  CancellationRequest,
  CancellationResult,
  Overrule,
  PageCount,
  Publication,
  PublicationResult,
  Recheck,
  RecheckResult,
  Reclassification,
  ReclassificationResult,
  ReleaseResult,
  Resume,
} from "@/api/iterations";
import { categoryPathOf } from "@/domain/categories";
import { followedIterationId } from "@/domain/documents";
import type { Document, Iteration, Session } from "@/domain/entities";
import {
  isCancellable,
  isOverrulable,
  isPublishable,
  isReclassifiable,
  isResumable,
  progressAfterGates,
  scopeOfIteration,
} from "@/domain/iterations";
import type { Permission } from "@/domain/permissions";
import { can } from "@/domain/permissions";
import { defectNameOf, isFoundAfterScan, pagesSubject, reviewStateOf } from "@/domain/validations";
import { repairedSubjectsOf } from "@/mocks/catalog";
import { database } from "@/mocks/database";
import { audienceOf } from "@/mocks/documents";
import { recordHookEvent } from "@/mocks/hooks";
import type { Outcome } from "@/mocks/mutations";
import { leafCategoryRefusal, progressNote, replaceIteration, writeLog } from "@/mocks/mutations";

export function reclassifyIteration(
  session: Session,
  iterationId: string,
  reclassification: Reclassification,
): Outcome<ReclassificationResult> {
  const found = actionableIteration(session, iterationId, "iteration.classify");
  if ("refusal" in found) {
    return found;
  }

  const { iteration } = found.value;
  if (!isReclassifiable(iteration)) {
    return {
      refusal: { status: 409, message: "It is scanned; its category and priority stay" },
    };
  }

  const refusal = leafCategoryRefusal(reclassification.categoryId);
  if (refusal !== null) {
    return { refusal };
  }

  const { categoryId, priority } = reclassification;
  if (categoryId === iteration.categoryId && priority === iteration.priority) {
    return { refusal: { status: 422, message: "Nothing changed" } };
  }

  replaceIteration({ ...iteration, categoryId, priority });
  // Outside the caller's custody it is someone else's from now on (V13).
  const isHandedOver = !can(
    session,
    "iteration.classify",
    scopeOfIteration(database.categories, categoryId),
  );
  writeLog({
    subjectKind: "iteration",
    subjectId: iteration.id,
    at: new Date().toISOString(),
    actor: { kind: "user", userId: session.user.id },
    correlationId: crypto.randomUUID(),
    event: "Reclassified",
    detail: [
      categoryId === iteration.categoryId
        ? null
        : `Category ${categoryNameOf(iteration.categoryId)} → ${categoryNameOf(categoryId)}.`,
      priority === iteration.priority ? null : `Priority ${iteration.priority} → ${priority}.`,
      isHandedOver ? "Handed over to the custody that holds the new category." : null,
    ]
      .filter((sentence) => sentence !== null)
      .join(" "),
  });

  return { value: { categoryId, priority, isHandedOver } };
}

export function publishIteration(
  session: Session,
  iterationId: string,
  publication: Publication,
): Outcome<PublicationResult> {
  const found = actionableIteration(session, iterationId, "iteration.publish");
  if ("refusal" in found) {
    return found;
  }

  const { iteration } = found.value;
  if (!isPublishable(iteration)) {
    return { refusal: { status: 409, message: "It is not digitized yet" } };
  }

  if (iteration.publishedLink === publication.link) {
    return { refusal: { status: 422, message: "It is already available there" } };
  }

  replaceIteration({ ...iteration, publishedLink: publication.link, progress: "Published" });
  const isChange = iteration.publishedLink !== null;
  writeLog({
    subjectKind: "iteration",
    subjectId: iteration.id,
    at: new Date().toISOString(),
    actor: { kind: "user", userId: session.user.id },
    correlationId: crypto.randomUUID(),
    event: isChange ? "Link changed" : "Published",
    detail: isChange ? `From ${iteration.publishedLink} to ${publication.link}.` : publication.link,
  });
  recordHookEvent(
    "iteration.published",
    iteration.id,
    "",
    `${iteration.id} is published at ${publication.link}`,
    {
      categoryPath: categoryPathOf(database.categories, iteration.categoryId).map(
        (category) => category.name,
      ),
    },
  );

  return { value: { publishedLink: publication.link, progress: "Published" } };
}

// ---------------------------------------------------------------- page count and recheck

// A counted page count goes in as the manual source, above the catalog and the predictor.
export function enterPageCount(
  session: Session,
  iterationId: string,
  pageCount: PageCount,
): Outcome<RecheckResult> {
  const found = fixableIteration(session, iterationId, "iteration.recheck");
  if ("refusal" in found) {
    return found;
  }

  const { iteration, document } = found.value;
  const now = new Date().toISOString();
  replaceDocument({
    ...document,
    pageSources: [
      ...document.pageSources.filter((source) => source.source !== "manual"),
      {
        source: "manual",
        tier: manualPageTier,
        value: pageCount.pages,
        observedAt: now,
        setBy: session.user.id,
      },
    ],
  });

  return {
    value: applyRecheck(session, iteration, [pagesSubject], {
      event: "Page count entered",
      detail: `${pageCount.pages.toLocaleString("en-GB")} pages, counted.`,
    }),
  };
}

// The manual source's tier in document-properties.md §4, as the fixtures carry it.
const manualPageTier = 100;

// Reads the record from the catalog again and runs the checks: what was repaired there is gone,
// everything else is found again with the same keys, so its verdicts still stand. Checks run at
// any time, after the scan too (status-model.md §2).
export function recheckIteration(
  session: Session,
  iterationId: string,
  _recheck: Recheck,
): Outcome<RecheckResult> {
  const found = actionableIteration(session, iterationId, "iteration.recheck");
  if ("refusal" in found) {
    return found;
  }

  const { iteration, document } = found.value;
  return {
    value: applyRecheck(session, iteration, repairedSubjectsOf(document.catalogId), {
      event: "Rechecked",
      detail: "The record was read from the catalog again.",
    }),
  };
}

// The iteration a page count may be entered for: not once scanned, since then the scan counts
// the pages and progress never moves back (C10).
function fixableIteration(
  session: Session,
  iterationId: string,
  permission: Permission,
): Outcome<Actionable> {
  const found = actionableIteration(session, iterationId, permission);
  if ("refusal" in found) {
    return found;
  }

  if (isFoundAfterScan(found.value.iteration)) {
    return {
      refusal: {
        status: 409,
        message: "It is scanned; the scan counts its pages",
        code: "iteration.scanned",
      },
    };
  }

  return found;
}

// The mock's check run: every defect on a repaired subject is gone. A real run asks the plugins
// again and may find the same defect, or a new one.
function recheck(iteration: Iteration, repairedSubjects: readonly string[]): Iteration {
  return {
    ...iteration,
    defects: iteration.defects.filter((defect) => !repairedSubjects.includes(defect.subject)),
  };
}

function applyRecheck(
  session: Session,
  iteration: Iteration,
  repairedSubjects: readonly string[],
  entry: { event: string; detail: string },
): RecheckResult {
  const rechecked = recheck(iteration, repairedSubjects);
  // Once scanned, progress never moves back (C10).
  const progress = isFoundAfterScan(iteration) ? iteration.progress : progressAfterGates(rechecked);
  replaceIteration({ ...rechecked, progress });
  const cleared = iteration.defects.filter((defect) => repairedSubjects.includes(defect.subject));
  writeLog({
    subjectKind: "iteration",
    subjectId: iteration.id,
    at: new Date().toISOString(),
    actor: { kind: "user", userId: session.user.id },
    correlationId: crypto.randomUUID(),
    event: entry.event,
    detail: [
      entry.detail,
      cleared.length === 0
        ? null
        : `The checks no longer find ${cleared.map(defectNameOf).join(", ")}.`,
      progressNote(iteration.progress, progress),
    ]
      .filter((sentence) => sentence !== null)
      .join(" "),
  });

  return {
    clearedKeys: cleared.map((defect) => defect.key),
    review: reviewStateOf({ ...rechecked, progress }),
    progress,
  };
}

// ---------------------------------------------------------------- cancel

// Held at the gate, not moved: progress stays, and Resume in Documents lets it through again.
// One on a list comes off it and stops counting as planned (flows.md C3), back to what its gates
// say; resumed, it returns to the pool, not to the old list.
export function cancelIteration(
  session: Session,
  iterationId: string,
  cancellation: CancellationRequest,
): Outcome<CancellationResult> {
  const found = actionableIteration(session, iterationId, "iteration.cancel");
  if ("refusal" in found) {
    return found;
  }

  const { iteration } = found.value;
  if (!isCancellable(iteration)) {
    return { refusal: { status: 409, message: "It is already held, or already scanned" } };
  }

  const now = new Date().toISOString();
  const progress =
    iteration.listId === null
      ? iteration.progress
      : progressAfterGates({ ...iteration, progress: "Ready" });
  replaceIteration({
    ...iteration,
    listId: null,
    progress,
    cancellation: {
      cause: "Decided",
      actorId: session.user.id,
      at: now,
      publicText: cancellation.publicText,
      internalText: cancellation.internalText,
    },
  });
  writeLog({
    subjectKind: "iteration",
    subjectId: iteration.id,
    at: now,
    actor: { kind: "user", userId: session.user.id },
    correlationId: crypto.randomUUID(),
    event: "Cancelled",
    detail: [
      `They were told: “${cancellation.publicText}”`,
      cancellation.internalText,
      iteration.listId === null ? null : `Taken off ${iteration.listId}.`,
    ]
      .filter((sentence) => sentence !== null)
      .join(" "),
  });

  const askerIds = database.requests
    .filter((request) => followedIterationId(request) === iteration.id)
    .map((request) => request.requesterId);
  return { value: { progress, askerCount: new Set(askerIds).size } };
}

// ---------------------------------------------------------------- resume

// The hold is lifted (ACT-resume): the item returns to the pool, not to its old list, so one
// marked could not be digitized comes off its list too (LC-ITER-resume). The gates then say
// whether it is Ready.
export function resumeIteration(
  session: Session,
  iterationId: string,
  _resume: Resume,
): Outcome<ReleaseResult> {
  const found = actionableIteration(session, iterationId, "iteration.resume");
  if ("refusal" in found) {
    return found;
  }

  const { iteration } = found.value;
  if (!isResumable(iteration)) {
    return { refusal: { status: 409, message: "It is not held, or it has been scanned" } };
  }

  const released = { ...iteration, listId: null, cancellation: null };
  const progress = progressAfterGates(
    iteration.listId === null ? released : { ...released, progress: "Ready" },
  );
  replaceIteration({ ...released, progress });
  writeLog({
    subjectKind: "iteration",
    subjectId: iteration.id,
    at: new Date().toISOString(),
    actor: { kind: "user", userId: session.user.id },
    correlationId: crypto.randomUUID(),
    event: "Resumed",
    detail: [
      iteration.listId === null ? null : `Taken off ${iteration.listId}.`,
      progressNote(iteration.progress, progress),
    ]
      .filter((sentence) => sentence !== null)
      .join(" "),
  });
  return { value: { progress } };
}

// ---------------------------------------------------------------- overrule

// An administrator lifts the restriction a rule found (ACT-overrule); `restriction.overrule` is
// held at `any` only, never custody. The finding stays beside the overrule, and the gates move
// progress (STAT-gates).
export function overruleRestriction(
  session: Session,
  iterationId: string,
  overrule: Overrule,
): Outcome<ReleaseResult> {
  const found = actionableIteration(session, iterationId, "restriction.overrule");
  if ("refusal" in found) {
    return found;
  }

  const { iteration } = found.value;
  if (!isOverrulable(iteration)) {
    return { refusal: { status: 409, message: "No restriction stands on it" } };
  }

  const now = new Date().toISOString();
  const overruled = {
    ...iteration,
    restrictionOverride: { actorId: session.user.id, at: now, note: overrule.note },
  };
  const progress = isFoundAfterScan(iteration) ? iteration.progress : progressAfterGates(overruled);
  replaceIteration({ ...overruled, progress });
  writeLog({
    subjectKind: "iteration",
    subjectId: iteration.id,
    at: now,
    actor: { kind: "user", userId: session.user.id },
    correlationId: crypto.randomUUID(),
    event: "Restriction overruled",
    detail: [
      `${iteration.restriction?.rule ?? "The rule"} no longer stops it.`,
      overrule.note,
      progressNote(iteration.progress, progress),
    ]
      .filter((sentence) => sentence !== null)
      .join(" "),
  });
  return { value: { progress } };
}

// ---------------------------------------------------------------- shared

interface Actionable {
  iteration: Iteration;
  document: Document;
}

// The document's current iteration within the caller's reach, and the grant to act on it.
export function actionableIteration(
  session: Session,
  iterationId: string,
  permission: Permission,
): Outcome<Actionable> {
  const iteration = database.iterations.find((candidate) => candidate.id === iterationId);
  const document = database.documents.find((candidate) => candidate.id === iteration?.documentId);
  if (iteration === undefined || document === undefined || audienceOf(session) !== "staff") {
    return { refusal: { status: 404, message: "No such iteration" } };
  }

  const attempts = database.iterations.filter((candidate) => candidate.documentId === document.id);
  const latest = Math.max(...attempts.map((candidate) => candidate.attempt));
  if (iteration.attempt !== latest) {
    return { refusal: { status: 409, message: "A later attempt has replaced this one" } };
  }

  if (!can(session, permission, scopeOfIteration(database.categories, iteration.categoryId))) {
    return { refusal: { status: 403, message: "This is outside what you may change" } };
  }

  return { value: { iteration, document } };
}

function categoryNameOf(categoryId: string): string {
  return categoryPathOf(database.categories, categoryId)
    .map((category) => category.name)
    .join(" / ");
}

function replaceDocument(document: Document): void {
  const index = database.documents.findIndex((candidate) => candidate.id === document.id);
  database.documents.splice(index, 1, document);
}
