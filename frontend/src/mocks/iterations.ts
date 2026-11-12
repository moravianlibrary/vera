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
} from "@vera/contract/iterations";
import { categoryPathOf } from "@vera/domain/categories";
import { followedIterationId } from "@vera/domain/documents";
import type { Document, Iteration, Session } from "@vera/domain/entities";
import {
  isCancellable,
  isOverrulable,
  isPublishable,
  isReclassifiable,
  isResumable,
  progressAfterGates,
  scopeOfIteration,
} from "@vera/domain/iterations";
import type { Permission } from "@vera/domain/permissions";
import { can } from "@vera/domain/permissions";
import {
  defectNameOf,
  isFoundAfterScan,
  pagesSubject,
  reviewStateOf,
} from "@vera/domain/validations";
import { knownCatalogRecords, repairedSubjectsOf } from "@/mocks/catalog";
import { database } from "@/mocks/database";
import { audienceOf } from "@/mocks/documents";
import { withCatalogReading } from "@/mocks/fixtures/properties";
import { recordHookEvent } from "@/mocks/hooks";
import { addLink, canonicalLinkOf, makePrimary, removeLink, replaceLink } from "@/mocks/links";
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
      refusal: {
        status: 409,
        code: "iteration.scanned",
        message: "It is scanned; its category and priority stay",
      },
    };
  }

  const refusal = leafCategoryRefusal(reclassification.categoryId);
  if (refusal !== null) {
    return { refusal };
  }

  const { categoryId, priority } = reclassification;
  if (categoryId === iteration.categoryId && priority === iteration.priority) {
    return {
      refusal: { status: 422, code: "iteration.nothing_changed", message: "Nothing changed" },
    };
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
    code: "iteration.reclassified",
    data: {
      category:
        categoryId === iteration.categoryId
          ? null
          : {
              from: { id: iteration.categoryId, name: categoryNameOf(iteration.categoryId) },
              to: { id: categoryId, name: categoryNameOf(categoryId) },
            },
      priority: priority === iteration.priority ? null : { from: iteration.priority, to: priority },
    },
    reason: {
      public: null,
      internal: isHandedOver ? "Handed over to the custody that holds the new category." : null,
    },
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
    return {
      refusal: {
        status: 409,
        code: "iteration.not_digitized",
        message: "It is not digitized yet.",
      },
    };
  }

  // A PID or a viewer's address is read by a Link instance (PLG-kinds).
  const link = canonicalLinkOf(publication.link);
  if (link === null) {
    return {
      refusal: {
        status: 422,
        code: "iteration.link_unread",
        message: "It is no web address, and no Link plugin reads it",
      },
    };
  }

  if (iteration.links.some((held) => held.url === link.url)) {
    return {
      refusal: {
        status: 422,
        code: "iteration.link_exists",
        message: "That link is already there.",
      },
    };
  }

  return {
    value: {
      links: addLink(iteration, link, { kind: "user", userId: session.user.id }).links,
      progress: "Published",
    },
  };
}

export function replaceIterationLink(
  session: Session,
  iterationId: string,
  linkId: string,
  publication: Publication,
): Outcome<PublicationResult> {
  const found = actionableIteration(session, iterationId, "iteration.publish");
  if ("refusal" in found) return found;
  const { iteration } = found.value;
  if (!iteration.links.some((link) => link.id === linkId))
    return { refusal: { status: 404, message: "No such link" } };
  const canonical = canonicalLinkOf(publication.link);
  if (canonical === null)
    return {
      refusal: {
        status: 422,
        code: "iteration.link_unread",
        message: "It is no web address, and no Link plugin reads it",
      },
    };
  if (iteration.links.some((link) => link.id !== linkId && link.url === canonical.url))
    return {
      refusal: {
        status: 422,
        code: "iteration.link_exists",
        message: "That link is already there.",
      },
    };
  return {
    value: {
      links: replaceLink(iteration, linkId, canonical, { kind: "user", userId: session.user.id })
        .links,
      progress: iteration.progress,
    },
  };
}

export function makeIterationLinkPrimary(
  session: Session,
  iterationId: string,
  linkId: string,
): Outcome<PublicationResult> {
  const found = actionableIteration(session, iterationId, "iteration.publish");
  if ("refusal" in found) return found;
  const { iteration } = found.value;
  const link = iteration.links.find((candidate) => candidate.id === linkId);
  if (link === undefined) return { refusal: { status: 404, message: "No such link" } };
  if (link.isPrimary)
    return {
      refusal: {
        status: 409,
        code: "iteration.already_primary_link",
        message: "It is already the primary link",
      },
    };
  return {
    value: {
      links: makePrimary(iteration, linkId, { kind: "user", userId: session.user.id }).links,
      progress: iteration.progress,
    },
  };
}

export function removeIterationLink(
  session: Session,
  iterationId: string,
  linkId: string,
): Outcome<PublicationResult> {
  const found = actionableIteration(session, iterationId, "iteration.publish");
  if ("refusal" in found) return found;
  const { iteration } = found.value;
  if (!iteration.links.some((link) => link.id === linkId))
    return { refusal: { status: 404, message: "No such link" } };
  if (iteration.links.length === 1)
    return {
      refusal: {
        status: 409,
        code: "iteration.last_link",
        message: "The last link cannot be removed",
      },
    };
  return {
    value: {
      links: removeLink(iteration, linkId, { kind: "user", userId: session.user.id }).links,
      progress: iteration.progress,
    },
  };
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
      code: "iteration.page_count_entered",
      data: {
        pages: pageCount.pages,
        previous:
          document.pageSources.toSorted((first, second) => second.tier - first.tier)[0]?.value ??
          null,
      },
      reason: { public: null, internal: null },
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
  // DOC-property-predefined: the mock's catalog reads back what VERA holds, read now.
  replaceDocument({
    ...document,
    properties: withCatalogReading(document, new Date().toISOString()),
  });
  const repairedSubjects = repairedSubjectsOf(document.catalogId);
  const gone = iteration.defects.filter((defect) =>
    repairedSubjects.includes(defect.subject),
  ).length;
  return {
    value: applyRecheck(session, iteration, repairedSubjects, {
      code: "iteration.rechecked",
      data: { by: "catalog_change", found: iteration.defects.length - gone, gone },
      reason: { public: null, internal: "The record was read from the catalog again." },
    }),
  };
}

// ACT-relink: the catalog record changes before its checks run, while the document's history stays.
export function relinkDocument(
  session: Session,
  documentId: string,
  input: { catalogId: string },
): Outcome<RecheckResult | null> {
  const document = database.documents.find((candidate) => candidate.id === documentId);
  if (document === undefined || audienceOf(session) !== "staff") {
    return { refusal: { status: 404, message: "No such document" } };
  }
  const iteration = database.iterations
    .filter((candidate) => candidate.documentId === documentId)
    .toSorted((first, second) => second.attempt - first.attempt)[0];
  const scope =
    iteration === undefined
      ? undefined
      : scopeOfIteration(database.categories, iteration.categoryId);
  if (!can(session, "iteration.recheck", scope)) {
    return {
      refusal: {
        status: 403,
        code: "iteration.outside_custody",
        message: "This is outside what you may change",
      },
    };
  }
  const catalogRecord = knownCatalogRecords().find(
    (candidate) => candidate.catalogId === input.catalogId,
  );
  if (
    catalogRecord === undefined ||
    (document.unit !== null && !catalogRecord.units?.includes(document.unit.value))
  ) {
    return {
      refusal: {
        status: 422,
        code: "document.catalog_unread",
        message: "The catalog does not read this record",
      },
    };
  }
  if (input.catalogId === document.catalogId) {
    return {
      refusal: {
        status: 422,
        code: "document.same_catalog_record",
        message: "Choose a different catalog record",
      },
    };
  }
  if (findHeldDocument(input.catalogId, document.unit?.value ?? null, documentId)) {
    return {
      refusal: {
        status: 409,
        code: "document.catalog_record_held",
        message: "Another document already holds this catalog record",
      },
    };
  }
  const at = new Date().toISOString();
  // DOC-relink: a relinked document has no catalog state left, so the read leaves the field out.
  const { catalogState: _cleared, ...unflagged } = document;
  const relinked = { ...unflagged, catalogId: input.catalogId };
  replaceDocument(relinked);
  writeLog({
    subjectKind: "document",
    subjectId: document.id,
    at,
    actor: { kind: "user", userId: session.user.id },
    correlationId: crypto.randomUUID(),
    code: "document.relinked",
    data: { catalogId: { from: document.catalogId, to: input.catalogId } },
    reason: { public: null, internal: null },
  });
  recordHookEvent("document.relinked", document.id, "", `Document ${document.id} was relinked`);
  if (iteration === undefined) {
    replaceDocument({ ...relinked, properties: withCatalogReading(relinked, at) });
    return { value: null };
  }
  return recheckIteration(session, iteration.id, {});
}

function findHeldDocument(catalogId: string, unit: string | null, exceptId: string): boolean {
  return database.documents.some(
    (candidate) =>
      candidate.id !== exceptId &&
      candidate.catalogId === catalogId &&
      (candidate.unit?.value ?? null) === unit,
  );
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
  entry: {
    code: "iteration.page_count_entered" | "iteration.rechecked";
    data: unknown;
    reason: { public: string | null; internal: string | null };
  },
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
    code: entry.code,
    data: entry.data as never,
    reason: {
      ...entry.reason,
      internal:
        [
          entry.reason.internal,
          cleared.length === 0
            ? null
            : `The checks no longer find ${cleared.map((defect) => defectNameOf(defect, (id) => database.pluginInstances.find((instance) => instance.id === id)?.name ?? id)).join(", ")}.`,
          progressNote(iteration.progress, progress),
        ]
          .filter((sentence) => sentence !== null)
          .join(" ") || entry.reason.internal,
    },
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
    return {
      refusal: {
        status: 409,
        code: "iteration.already_held",
        message: "It is already held, or already scanned",
      },
    };
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
    code: "iteration.cancelled",
    data: {
      list:
        iteration.listId === null
          ? null
          : {
              id: iteration.listId,
              name:
                database.lists.find((list) => list.id === iteration.listId)?.name ??
                iteration.listId,
            },
    },
    reason: { public: cancellation.publicText, internal: cancellation.internalText || null },
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
    return {
      refusal: {
        status: 409,
        code: "iteration.not_held",
        message: "It is not held, or it has been scanned",
      },
    };
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
    code: "iteration.resumed",
    data: {},
    reason: {
      public: null,
      internal:
        [
          iteration.listId === null ? null : `Taken off ${iteration.listId}.`,
          progressNote(iteration.progress, progress),
        ]
          .filter((sentence) => sentence !== null)
          .join(" ") || null,
    },
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
    return {
      refusal: {
        status: 409,
        code: "iteration.no_restriction",
        message: "No restriction stands on it",
      },
    };
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
    code: "iteration.restriction_overruled",
    data: {
      rule: {
        id: iteration.restriction?.rule ?? "unknown",
        name: iteration.restriction?.rule ?? "Unknown rule",
      },
    },
    reason: {
      public: null,
      internal:
        [
          `${iteration.restriction?.rule ?? "The rule"} no longer stops it.`,
          overrule.note,
          progressNote(iteration.progress, progress),
        ]
          .filter((sentence) => sentence !== null)
          .join(" ") || null,
    },
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
    return {
      refusal: {
        status: 409,
        code: "iteration.not_current",
        message: "A later attempt has replaced this one",
      },
    };
  }

  if (!can(session, permission, scopeOfIteration(database.categories, iteration.categoryId))) {
    return {
      refusal: {
        status: 403,
        code: "iteration.outside_custody",
        message: "This is outside what you may change",
      },
    };
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
