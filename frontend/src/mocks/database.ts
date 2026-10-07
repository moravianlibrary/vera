// The mock server's in-memory state: the fixtures, repeated `VITE_MOCK_DOCUMENT_COPIES` times,
// plus whatever the session writes. Reloading the page resets it.

import { env } from "@/config/env";
import type { Watchlist } from "@/domain/entities";
import { categoryMembers, groups, roles, userAccess } from "@/mocks/fixtures/access";
import { batches } from "@/mocks/fixtures/batches";
import { categories } from "@/mocks/fixtures/categories";
import { documents } from "@/mocks/fixtures/documents";
import { identityInstances } from "@/mocks/fixtures/identity";
import { distributions, intentions, intentionTemplates } from "@/mocks/fixtures/intentions";
import { iterations } from "@/mocks/fixtures/iterations";
import { lists } from "@/mocks/fixtures/lists";
import { pluginInstances } from "@/mocks/fixtures/plugins";
import { projects } from "@/mocks/fixtures/projects";
import { proposalCustodies } from "@/mocks/fixtures/proposal-custodies";
import { requests } from "@/mocks/fixtures/requests";
import { statusLog } from "@/mocks/fixtures/status-log";
import { retention, runs, schedules } from "@/mocks/fixtures/tasks";
import { users } from "@/mocks/fixtures/users";
import { watchlists } from "@/mocks/fixtures/watchlists";
import { withCopies } from "@/mocks/volume";

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
  identityInstances,
  categories: [...categories],
  // Category custody: groups carry theirs, and people hold it directly by category; both are
  // written by Grant custody… on Categories.
  groups: [...groups],
  categoryMembers: { ...categoryMembers },
  projects: [...projects],
  intentions: [...intentions],
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
  pluginInstances,
  runs: [...runs],
  schedules: [...schedules],
  // Changed by Keep runs for… on Tasks.
  taskRetention: { ...retention },
};
