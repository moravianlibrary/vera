// The mock's proposal adapters and writes for the shared proposal query.

import type { ProposalDraft, ProposalReport } from "@vera/contract/proposals";
import { planSubmission } from "@vera/contract/queries/proposals";

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
import { catalogRecords } from "@/mocks/fixtures/catalog";
import { catalogPropertyValuesOf } from "@/mocks/fixtures/properties";
import { writeLog } from "@/mocks/mutations";
import { waysInOf } from "@/mocks/ways-in";

export const mockProposalPlugins: ProposalPlugins = {
  catalogRecords: () => [...catalogRecords, ...database.volumeCatalogRecords],
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
  for (const event of writes.events) writeLog(event);
  return report;
}
