// What the server does when somebody retries a batch's failed additions (ACT-retry-batch): every
// document of the batch whose ingest failed, within the scope of their `request.retry`, goes back
// to ingest, being added again, with its attempt counted and the retry logged. The mock runs no
// ingest, so they stay being added.

import type { BatchRetryResult } from "@vera/contract/additions";
import { batchIdOf, currentIterationOf } from "@vera/domain/documents";
import type { Iteration, Session } from "@vera/domain/entities";
import { scopeOfIteration } from "@vera/domain/iterations";
import { can } from "@vera/domain/permissions";
import { database } from "@/mocks/database";
import { recordOf } from "@/mocks/documents";
import type { Outcome } from "@/mocks/mutations";
import { replaceIteration, writeLog } from "@/mocks/mutations";

export function retryBatch(session: Session, batchId: string): Outcome<BatchRetryResult> {
  if (!can(session, "request.retry")) {
    return { refusal: { status: 403, message: "You may not retry additions" } };
  }

  if (!database.batches.some((batch) => batch.id === batchId)) {
    return { refusal: { status: 404, message: "No such batch" } };
  }

  const failed = database.documents
    .map(recordOf)
    .filter((record) => batchIdOf(record) === batchId)
    .map(currentIterationOf)
    .filter((iteration): iteration is Iteration => iteration?.progress === "IngestFailed");
  if (failed.length === 0) {
    return { refusal: { status: 409, message: "Nothing in this batch failed to be added" } };
  }

  const retried = failed.filter((iteration) =>
    can(session, "request.retry", scopeOfIteration(database.categories, iteration.categoryId)),
  );
  if (retried.length === 0) {
    return { refusal: { status: 403, message: "What failed is outside your custody" } };
  }

  const now = new Date().toISOString();
  const correlationId = crypto.randomUUID();
  for (const iteration of retried) {
    const attempts = (iteration.ingestFailure?.attempts ?? 0) + 1;
    // The last failure is kept with the count, so the record still says what went wrong before.
    replaceIteration({
      ...iteration,
      progress: "Enqueued",
      ingestFailure: { attempts, error: iteration.ingestFailure?.error ?? null },
    });
    writeLog({
      subjectKind: "request",
      subjectId: iteration.requestId,
      at: now,
      actor: { kind: "user", userId: session.user.id },
      correlationId,
      code: "request.ingest_retried",
      data: { attempt: attempts },
      reason: { public: null, internal: null },
    });
  }

  return { value: { batchId, retriedIds: retried.map((iteration) => iteration.id) } };
}
