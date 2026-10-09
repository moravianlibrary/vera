// The mock server's in-memory state: the fixtures, repeated `VITE_MOCK_DOCUMENT_COPIES` times,
// plus whatever the session writes. Reloading the page resets it.

import { env } from "@/config/env";
import type { IntentionRow } from "@/api/intentions";
import type { MixTree } from "@/api/mixes";
import type { Category, Watchlist } from "@/domain/entities";
import { categoryMembers, groups, roles, userAccess } from "@/mocks/fixtures/access";
import { batches } from "@/mocks/fixtures/batches";
import { categories } from "@/mocks/fixtures/categories";
import { documents } from "@/mocks/fixtures/documents";
import { hookAttempts, hookDeliveries, hooks } from "@/mocks/fixtures/hooks";
import { distributions, intentions, intentionTemplates } from "@/mocks/fixtures/intentions";
import { iterations } from "@/mocks/fixtures/iterations";
import { lists } from "@/mocks/fixtures/lists";
import { pluginImplementations, pluginInstances } from "@/mocks/fixtures/plugins";
import { projects } from "@/mocks/fixtures/projects";
import { proposalCustodies } from "@/mocks/fixtures/proposal-custodies";
import { requests } from "@/mocks/fixtures/requests";
import { statusLog } from "@/mocks/fixtures/status-log";
import { retention, runs, schedules } from "@/mocks/fixtures/tasks";
import { users } from "@/mocks/fixtures/users";
import { watchlists } from "@/mocks/fixtures/watchlists";
import type { StoredUpload } from "@/mocks/plugins";
import { withCopies } from "@/mocks/volume";
import type { StoredWatchlistViewer } from "@/mocks/watchlists";

// The owner is who saved it; for a shared watchlist that says nothing about who sees it.
export interface StoredWatchlist extends Watchlist {
  readonly ownerId: string;
}

const records = withCopies(
  { documents, iterations, requests, statusLog },
  env.VITE_MOCK_DOCUMENT_COPIES,
);

export const database = {
  // People and agents; Users & Groups adds local accounts.
  users: [...users],
  // Roles, how each person holds them, and the groups: written by Users & Groups.
  roles: [...roles],
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
  intentionTemplates: [...intentionTemplates],
  lists: [...lists],
  batches: [...batches],
  proposalCustodies: [...proposalCustodies],
  documents: [...records.documents],
  iterations: [...records.iterations],
  requests: [...records.requests],
  statusLog: [...records.statusLog],
  watchlists: [...watchlists],
  // Each person's own row for a watchlist they see: seen, badge, hidden, place.
  watchlistViewers: [] as StoredWatchlistViewer[],
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
  // Changed by Keep runs for… on Tasks.
  taskRetention: { ...retention },
};
