// What the server does when someone changes a document's current iteration from the Documents
// pane: relink it to another catalog record (S3, flows.md G3), reclassify it (C6, V13) or set
// where its scan is available (P1). Each checks its permission against the iteration's category,
// refuses what the iteration's state does not allow, and writes the status log.

import type {
  Publication,
  PublicationResult,
  Reclassification,
  ReclassificationResult,
  Relink,
  RelinkResult,
} from "@/api/iterations";
import { categoryPathOf } from "@/domain/categories";
import { documentIdentifierOf } from "@/domain/documents";
import type { Document, Iteration, Session } from "@/domain/entities";
import { isPublishable, isReclassifiable, scopeOfIteration } from "@/domain/iterations";
import type { Permission } from "@/domain/permissions";
import { can } from "@/domain/permissions";
import { findDocumentByIdentity, knownCatalogRecords, unitTypeOf } from "@/mocks/catalog";
import { database } from "@/mocks/database";
import { audienceOf } from "@/mocks/documents";
import type { Outcome } from "@/mocks/mutations";
import { leafCategoryRefusal, replaceIteration, writeLog } from "@/mocks/mutations";

// The defect a missing catalog record raises; relinking to a record the catalog knows clears it.
const catalogRecordSubject = "record";

export function relinkIteration(
  session: Session,
  iterationId: string,
  relink: Relink,
): Outcome<RelinkResult> {
  const found = actionableIteration(session, iterationId, "iteration.relink");
  if ("refusal" in found) {
    return found;
  }

  const { iteration, document } = found.value;
  const catalogId = relink.catalogId.toUpperCase();
  const record = knownCatalogRecords().find((candidate) => candidate.catalogId === catalogId);
  if (record === undefined) {
    return { refusal: { status: 422, message: `The catalog has no record ${catalogId}` } };
  }

  if (record.units === null && relink.unit !== null) {
    return { refusal: { status: 422, message: `${catalogId} is one document, with no volumes` } };
  }

  if (record.units !== null && (relink.unit === null || !record.units.includes(relink.unit))) {
    return {
      refusal: {
        status: 422,
        message: `Choose one of its volumes or issues: ${record.units.join(", ")}`,
      },
    };
  }

  const holder = findDocumentByIdentity(catalogId, relink.unit);
  if (holder?.id === document.id) {
    return { refusal: { status: 422, message: "It is already linked to that record" } };
  }

  if (holder !== null) {
    return {
      refusal: { status: 409, message: `That record is already ${holder.title} in VERA` },
    };
  }

  const relinked: Document = {
    ...document,
    catalogId,
    unit: relink.unit === null ? null : { type: unitTypeOf(relink.unit), value: relink.unit },
    title: record.title,
  };
  replaceDocument(relinked);
  // The re-check finds the record now, so its defect goes; the other checks keep theirs.
  const hadNoRecord = iteration.defects.some((defect) => defect.subject === catalogRecordSubject);
  replaceIteration({
    ...iteration,
    defects: iteration.defects.filter((defect) => defect.subject !== catalogRecordSubject),
  });
  writeLog({
    subjectKind: "iteration",
    subjectId: iteration.id,
    at: new Date().toISOString(),
    actor: { kind: "user", userId: session.user.id },
    correlationId: crypto.randomUUID(),
    event: "Relinked",
    detail: [
      `From ${documentIdentifierOf(document)} to ${documentIdentifierOf(relinked)}.`,
      hadNoRecord ? "The catalog record is found again." : null,
    ]
      .filter((sentence) => sentence !== null)
      .join(" "),
  });

  return {
    value: { documentId: document.id, catalogId, unit: relink.unit, title: record.title },
  };
}

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

  return { value: { publishedLink: publication.link, progress: "Published" } };
}

// ---------------------------------------------------------------- shared

interface Actionable {
  iteration: Iteration;
  document: Document;
}

// The document's current iteration within the caller's reach, and the grant to act on it.
function actionableIteration(
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
