// The mock server's in-memory state: the fixtures, repeated `VITE_MOCK_DOCUMENT_COPIES` times,
// plus whatever the session writes. Reloading the page resets it.

import type { IntentionRow } from "@vera/contract/intentions";
import type { MixTree } from "@vera/contract/mixes";
import type { Category, StatusLogEntry, Watchlist } from "@vera/domain/entities";
import type { RecordStore } from "@vera/domain/store";
import { env } from "@/config/env";
import { categoryMembers, groups, roles, userAccess } from "@/mocks/fixtures/access";
import { batches } from "@/mocks/fixtures/batches";
import type { CatalogRecord } from "@/mocks/fixtures/catalog";
import { categories } from "@/mocks/fixtures/categories";
import { documents } from "@/mocks/fixtures/documents";
import { hookAttempts, hookDeliveries, hooks } from "@/mocks/fixtures/hooks";
import { distributions, intentions, intentionTemplates } from "@/mocks/fixtures/intentions";
import { iterations } from "@/mocks/fixtures/iterations";
import { lists } from "@/mocks/fixtures/lists";
import { pluginImplementations, pluginInstances } from "@/mocks/fixtures/plugins";
import { projects } from "@/mocks/fixtures/projects";
import type { StoredPropertyDefinition } from "@/mocks/fixtures/properties";
import { propertyDefinitions, propertyGrants } from "@/mocks/fixtures/properties";
import { requestCustodies } from "@/mocks/fixtures/request-custodies";
import { requests } from "@/mocks/fixtures/requests";
import { statusLog } from "@/mocks/fixtures/status-log";
import { retention, runs, schedules } from "@/mocks/fixtures/tasks";
import { users } from "@/mocks/fixtures/users";
import { watchlists } from "@/mocks/fixtures/watchlists";
import type { StoredUpload } from "@/mocks/plugins";
import type { MockSystemMail, PasswordResetToken, PendingSignUp } from "@/mocks/sign-up";
import { mockToday } from "@/mocks/today";
import { withCopies } from "@/mocks/volume";
import { readWatchlistBaselines, readWatchlistEntries } from "@/mocks/watchlist-entries";
import { readWatchlistViewers } from "@/mocks/watchlist-viewer-store";
import type { StoredWatchlistViewer } from "@/mocks/watchlists";

// The owner is who saved it; for a shared watchlist that says nothing about who sees it.
export interface StoredWatchlist extends Watchlist {
  readonly ownerId: string;
  readonly filterVersion?: number;
  readonly copiedFrom?: string;
}

const records = withCopies(
  { documents, iterations, requests, statusLog },
  env.VITE_MOCK_DOCUMENT_COPIES,
);

export const database = {
  // People and agents; Users & Groups adds local accounts.
  users: [...users],
  // Roles, how each person holds them, and the groups: written by Users & Groups.
  roles: roles.map((role) => ({
    ...role,
    grants: [...role.grants, ...(propertyGrants[role.id] ?? [])],
  })),
  userAccess: { ...userAccess },
  categories: [...categories],
  // Category custody: groups carry theirs, and people hold it directly by category; both are
  // written by Grant custody… on Categories.
  groups: [...groups],
  categoryMembers: { ...categoryMembers },
  projects: [...projects],
  intentions: [...intentions],
  // The displayed result at Archive time, independent of later work and category changes.
  archivedIntentionRows: {} as Record<string, IntentionRow>,
  archivedIntentionMixes: {} as Record<string, MixTree>,
  archivedIntentionCategories: {} as Record<string, Category[]>,
  distributions: [...distributions],
  // A mix may be removed only before any intention or repeat has ever selected it. Keep the
  // history when an intention is later deleted, and never reuse a removed mix's id.
  mixUsedIds: new Set<string>([
    ...intentions.flatMap((intention) =>
      intention.distributionId === null ? [] : [intention.distributionId],
    ),
    ...intentionTemplates.flatMap((template) =>
      template.distributionId === null ? [] : [template.distributionId],
    ),
    ...lists.flatMap((list) => (list.generated?.mixId == null ? [] : [list.generated.mixId])),
  ]),
  deletedMixIds: new Set<string>(),
  intentionTemplates: [...intentionTemplates],
  lists: [...lists],
  batches: [...batches],
  requestCustodies: [...requestCustodies],
  documents: [...records.documents],
  iterations: [...records.iterations],
  requests: [...records.requests],
  volumeCatalogRecords: [] as CatalogRecord[],
  statusLog: [...records.statusLog] as StatusLogEntry[],
  watchlists: [...watchlists],
  // Each person's own row for a watchlist they see: seen, place and delivery.
  watchlistViewers: readWatchlistViewers() as StoredWatchlistViewer[],
  watchlistEntries: readWatchlistEntries(),
  watchlistBaselines: readWatchlistBaselines(),
  // Written by Plugins: instances made, edited, switched off and deleted; versions uploaded.
  pluginImplementations: [...pluginImplementations],
  pluginInstances: [...pluginInstances],
  hooks: [...hooks],
  hookDeliveries: [...hookDeliveries],
  hookAttempts: [...hookAttempts],
  // Packages read and waiting to be installed.
  pluginUploads: [] as StoredUpload[],
  runs: [...runs],
  schedules: [...schedules],
  // Written by the Properties page; a deleted key is kept so it is never defined again.
  propertyDefinitions: [...propertyDefinitions] as StoredPropertyDefinition[],
  deletedPropertyKeys: [] as string[],
  pendingSignUps: [] as PendingSignUp[],
  passwordResets: [] as PasswordResetToken[],
  systemMail: [] as MockSystemMail[],
  // Changed by Keep runs for… on Tasks.
  taskRetention: { ...retention },
};

export function mockStore(): RecordStore {
  return {
    today: mockToday,
    catalogPropertyKeys: new Set(
      database.pluginImplementations
        .filter((implementation) => implementation.kind === "CatalogAdapter")
        .flatMap((implementation) => implementation.versions)
        .flatMap((version) => version.declares.properties.map(({ key }) => key)),
    ),
    // Query indexes use array identity, so each store snapshots every collection.
    users: [...database.users],
    roles: [...database.roles],
    groups: [...database.groups],
    categories: [...database.categories],
    projects: [...database.projects],
    batches: [...database.batches],
    requestCustodies: [...database.requestCustodies],
    documents: [...database.documents],
    iterations: [...database.iterations],
    requests: [...database.requests],
    statusLog: [...database.statusLog],
    propertyDefinitions: [...database.propertyDefinitions],
  };
}
