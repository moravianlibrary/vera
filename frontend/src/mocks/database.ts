// The mock server's in-memory state: the fixtures, repeated `VITE_MOCK_DOCUMENT_COPIES` times,
// plus whatever the session writes. Reloading the page resets it.

import { env } from "@/config/env";
import type { Watchlist } from "@/domain/entities";
import { batches } from "@/mocks/fixtures/batches";
import { categories } from "@/mocks/fixtures/categories";
import { documents } from "@/mocks/fixtures/documents";
import { iterations } from "@/mocks/fixtures/iterations";
import { lists } from "@/mocks/fixtures/lists";
import { projects } from "@/mocks/fixtures/projects";
import { requests } from "@/mocks/fixtures/requests";
import { statusLog } from "@/mocks/fixtures/status-log";
import { users } from "@/mocks/fixtures/users";
import { watchlists } from "@/mocks/fixtures/watchlists";
import { withCopies } from "@/mocks/volume";

export interface StoredWatchlist extends Watchlist {
  readonly ownerId: string;
}

const records = withCopies(
  { documents, iterations, requests, statusLog },
  env.VITE_MOCK_DOCUMENT_COPIES,
);

export const database = {
  users,
  categories,
  projects,
  lists,
  batches,
  ...records,
  watchlists: [...watchlists],
};
