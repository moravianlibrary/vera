// The mock's proposal adapters and writes for the shared proposal query.

import type { ProposalDraft, ProposalReport } from "@vera/contract/proposals";
import { planProposalCheck, planSubmission } from "@vera/contract/queries/proposals";

export {
  canSubmitRateLimited,
  checkItem,
  getRateLimitStatus,
  proposableProjectsOf,
  proposalLimitOf,
  proposalSettingsOf,
  submittableProposalItemCount,
} from "@vera/contract/queries/proposals";

import type { ProposalPlugins } from "@vera/contract/queries/proposals";
import type { Session } from "@vera/domain/entities";
import { database, mockStore } from "@/mocks/database";
import { catalogRecords, registryAnswers } from "@/mocks/fixtures/catalog";
import { catalogPropertyValuesOf } from "@/mocks/fixtures/properties";
import { writeLog } from "@/mocks/mutations";
import { waysInOf } from "@/mocks/ways-in";

export const mockProposalPlugins: ProposalPlugins = {
  catalogRecords: () => [...catalogRecords, ...database.volumeCatalogRecords],
  registryLookup: (record, unit) => registryAnswers[`${record.catalogId}|${unit ?? ""}`] ?? [],
  catalogPropertyValuesOf,
  waysIn: waysInOf,
};

export function submitProposal(session: Session, draft: ProposalDraft): ProposalReport {
  const { writes, report } = planSubmission(
    mockStore(),
    mockProposalPlugins,
    session,
    draft,
    new Date(),
    (prefix) => `${prefix}-${crypto.randomUUID()}`,
  );
  if (writes.batch !== null) database.batches.push(writes.batch);
  database.documents.push(...writes.documents);
  database.iterations.push(...writes.iterations);
  database.requests.push(...writes.requests);
  database.pendingProposalChecks.push(
    ...writes.requests.filter((request) => request.checkedAt === null).map(({ id }) => id),
  );
  for (const event of writes.events) writeLog(event);
  return report;
}

// LC-REQ-checks-job: the server queues checks at submit and runs them only on the jobs control.
export function runProposalChecks(): { ran: number; failed: number } {
  let ran = 0;
  const now = new Date();
  const pending = database.pendingProposalChecks.splice(0);
  for (const requestId of pending) {
    const writes = planProposalCheck(
      mockStore(),
      mockProposalPlugins,
      requestId,
      now,
      () => `IT-${crypto.randomUUID()}`,
    );
    if (writes === null) continue;
    for (const document of writes.documents) {
      const index = database.documents.findIndex(({ id }) => id === document.id);
      if (index !== -1) database.documents.splice(index, 1, document);
    }
    database.iterations.push(...writes.iterations);
    const request = writes.requests[0];
    if (request !== undefined) {
      const index = database.requests.findIndex(({ id }) => id === request.id);
      if (index !== -1) database.requests.splice(index, 1, request);
    }
    for (const event of writes.events) writeLog(event);
    ran++;
  }
  return { ran, failed: 0 };
}
