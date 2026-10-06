// What the server does when an administrator retries a batch's failed additions (use case A1,
// flows.md G2): every document of the batch whose ingest failed goes back to ingest, being added
// again, with its attempt counted and the retry logged. The mock runs no ingest, so they stay
// being added.

import type { BatchRetryResult } from "@/api/additions";
import { batchIdOf, currentIterationOf } from "@/domain/documents";
import type { Iteration, Session } from "@/domain/entities";
import { can } from "@/domain/permissions";
import { database } from "@/mocks/database";
import { recordOf } from "@/mocks/documents";
import type { Outcome } from "@/mocks/mutations";
import { replaceIteration, writeLog } from "@/mocks/mutations";

export function retryBatch(session: Session, batchId: string): Outcome<BatchRetryResult> {
  if (!can(session, "addition.retry")) {
    return { refusal: { status: 403, message: "Only an administrator retries additions" } };
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

  const now = new Date().toISOString();
  const correlationId = crypto.randomUUID();
  for (const iteration of failed) {
    const attempts = (iteration.ingestFailure?.attempts ?? 0) + 1;
    // The last failure is kept with the count, so the record still says what went wrong before.
    replaceIteration({
      ...iteration,
      progress: "Enqueued",
      ingestFailure: { attempts, error: iteration.ingestFailure?.error ?? null },
    });
    writeLog({
      subjectKind: "iteration",
      subjectId: iteration.id,
      at: now,
      actor: { kind: "user", userId: session.user.id },
      correlationId,
      event: "Ingest retried",
      detail: `With batch ${batchId}; attempt ${attempts}.`,
    });
  }

  return { value: { batchId, retriedIds: failed.map((iteration) => iteration.id) } };
}
