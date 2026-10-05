// MSW handlers: the fake API at the HTTP boundary. They answer as one emulated user, VITE_MOCK_USER
// in the browser, so components, queries and forms run unchanged against the real API later.

import { HttpResponse, http } from "msw";
import {
  parseDocumentGrouping,
  parseDocumentSearchParams,
  parseDocumentSliceParams,
} from "@/api/documents";
import { apiRoutes } from "@/api/routes";
import { watchlistChangeSchema, watchlistDraftSchema, watchlistViewParam } from "@/api/watchlists";
import type { MockUserProfile } from "@/config/env";
import { env } from "@/config/env";
import type { Session } from "@/domain/entities";
import { watchlistViewSchema } from "@/domain/entities";
import { database } from "@/mocks/database";
import { findDocumentDetail, queryDocuments } from "@/mocks/documents";
import { resolveSession } from "@/mocks/session";
import { findOwnWatchlist, ownWatchlists, publicWatchlistOf } from "@/mocks/watchlists";

const route = (path: string) => `${env.VITE_API_BASE_URL}${path}`;

export function createHandlers(profile: MockUserProfile) {
  const currentSession = (): Session => resolveSession(profile);

  return [
    http.get(route(apiRoutes.session), () => HttpResponse.json(currentSession())),

    http.get(route(apiRoutes.users), () => HttpResponse.json(database.users)),
    http.get(route(apiRoutes.categories), () => HttpResponse.json(database.categories)),
    http.get(route(apiRoutes.projects), () => HttpResponse.json(database.projects)),
    http.get(route(apiRoutes.lists), () => HttpResponse.json(database.lists)),
    http.get(route(apiRoutes.batches), () => HttpResponse.json(database.batches)),

    http.get(route(apiRoutes.documents), ({ request }) => {
      const params = new URL(request.url).searchParams;
      const page = queryDocuments(
        currentSession(),
        parseDocumentSearchParams(params),
        parseDocumentSliceParams(params),
        parseDocumentGrouping(params),
      );
      return HttpResponse.json(page);
    }),

    http.get(route(`${apiRoutes.documents}/:documentId`), ({ params }) => {
      const detail = findDocumentDetail(currentSession(), String(params.documentId));
      if (detail === null) {
        return HttpResponse.json({ message: "Document not found" }, { status: 404 });
      }

      return HttpResponse.json(detail);
    }),

    http.get(route(apiRoutes.watchlists), ({ request }) => {
      const view = watchlistViewSchema.safeParse(
        new URL(request.url).searchParams.get(watchlistViewParam),
      );
      return HttpResponse.json(ownWatchlists(currentSession(), view.success ? view.data : null));
    }),

    http.post(route(apiRoutes.watchlists), async ({ request }) => {
      const draft = watchlistDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return HttpResponse.json({ message: draft.error.message }, { status: 422 });
      }

      const watchlist = {
        ...draft.data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      database.watchlists.push({ ...watchlist, ownerId: currentSession().user.id });
      return HttpResponse.json(watchlist, { status: 201 });
    }),

    http.patch(route(`${apiRoutes.watchlists}/:watchlistId`), async ({ params, request }) => {
      const watchlist = findOwnWatchlist(currentSession(), String(params.watchlistId));
      if (watchlist === null) {
        return HttpResponse.json({ message: "Watchlist not found" }, { status: 404 });
      }

      const change = watchlistChangeSchema.safeParse(await request.json());
      if (!change.success) {
        return HttpResponse.json({ message: change.error.message }, { status: 422 });
      }

      const changed = { ...watchlist, ...change.data };
      database.watchlists.splice(database.watchlists.indexOf(watchlist), 1, changed);
      return HttpResponse.json(publicWatchlistOf(changed));
    }),

    http.delete(route(`${apiRoutes.watchlists}/:watchlistId`), ({ params }) => {
      const watchlist = findOwnWatchlist(currentSession(), String(params.watchlistId));
      if (watchlist === null) {
        return HttpResponse.json({ message: "Watchlist not found" }, { status: 404 });
      }

      database.watchlists.splice(database.watchlists.indexOf(watchlist), 1);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}

export const handlers = createHandlers(env.VITE_MOCK_USER);
