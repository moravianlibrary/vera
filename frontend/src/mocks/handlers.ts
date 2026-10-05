// MSW handlers: the fake API at the HTTP boundary. They answer as one emulated user, VITE_MOCK_USER
// in the browser, so components, queries and forms run unchanged against the real API later.

import { HttpResponse, http } from "msw";
import {
  parseDocumentGrouping,
  parseDocumentSearchParams,
  parseDocumentSliceParams,
} from "@/api/documents";
import { proposalDraftSchema, proposalLookupSchema } from "@/api/proposals";
import { apiRoutes } from "@/api/routes";
import { watchlistChangeSchema, watchlistDraftSchema, watchlistViewParam } from "@/api/watchlists";
import type { MockUserProfile } from "@/config/env";
import { env } from "@/config/env";
import type { Session } from "@/domain/entities";
import { watchlistViewSchema } from "@/domain/entities";
import { hasPermission } from "@/domain/permissions";
import type { StoredWatchlist } from "@/mocks/database";
import { database } from "@/mocks/database";
import { findDocumentDetail, queryDocuments } from "@/mocks/documents";
import {
  checkItem,
  proposableProjectsOf,
  proposalLimitOf,
  proposalSettings,
  submitProposal,
} from "@/mocks/proposals";
import { resolveSession } from "@/mocks/session";
import {
  canChange,
  findDuplicateWatchlist,
  findVisibleWatchlist,
  publicWatchlistOf,
  visibleWatchlists,
} from "@/mocks/watchlists";

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

    http.get(route(apiRoutes.proposalSettings), () => HttpResponse.json(proposalSettings)),

    http.post(route(apiRoutes.proposalLookup), async ({ request }) => {
      const session = currentSession();
      if (!hasPermission(session, "request.create")) {
        return HttpResponse.json({ message: "You may not propose" }, { status: 403 });
      }

      const lookup = proposalLookupSchema.safeParse(await request.json());
      if (!lookup.success) {
        return HttpResponse.json({ message: lookup.error.message }, { status: 422 });
      }

      return HttpResponse.json(lookup.data.items.map((item) => checkItem(session, item)));
    }),

    http.post(route(apiRoutes.proposals), async ({ request }) => {
      const session = currentSession();
      const draft = proposalDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return HttpResponse.json({ message: draft.error.message }, { status: 422 });
      }

      const isApprovalRefused =
        draft.data.approval !== null && !hasPermission(session, "request.decide");
      if (!hasPermission(session, "request.create") || isApprovalRefused) {
        return HttpResponse.json({ message: "You may not propose this" }, { status: 403 });
      }

      if (draft.data.items.length > proposalLimitOf(session)) {
        return HttpResponse.json(
          { message: `At most ${proposalLimitOf(session)} items at once` },
          { status: 422 },
        );
      }

      const isProjectRefused =
        draft.data.projectId !== null &&
        !proposableProjectsOf(session).some((project) => project.id === draft.data.projectId);
      if (isProjectRefused) {
        return HttpResponse.json(
          { message: "Only a member proposes into a project, and not into a rejected one" },
          { status: 422 },
        );
      }

      return HttpResponse.json(submitProposal(session, draft.data), { status: 201 });
    }),

    http.get(route(apiRoutes.watchlists), ({ request }) => {
      const view = watchlistViewSchema.safeParse(
        new URL(request.url).searchParams.get(watchlistViewParam),
      );
      return HttpResponse.json(
        visibleWatchlists(currentSession(), view.success ? view.data : null),
      );
    }),

    http.post(route(apiRoutes.watchlists), async ({ request }) => {
      const session = currentSession();
      const draft = watchlistDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return HttpResponse.json({ message: draft.error.message }, { status: 422 });
      }

      if (!canChange(session, draft.data.scope)) {
        return forbidden();
      }

      const duplicate = findDuplicateWatchlist(session, { ...draft.data, id: null });
      if (duplicate !== null) {
        return alreadySaved(duplicate);
      }

      const watchlist = {
        ...draft.data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      database.watchlists.push({ ...watchlist, ownerId: session.user.id });
      return HttpResponse.json(watchlist, { status: 201 });
    }),

    http.patch(route(`${apiRoutes.watchlists}/:watchlistId`), async ({ params, request }) => {
      const session = currentSession();
      const watchlist = findVisibleWatchlist(session, String(params.watchlistId));
      if (watchlist === null) {
        return HttpResponse.json({ message: "Watchlist not found" }, { status: 404 });
      }

      if (!canChange(session, watchlist.scope)) {
        return forbidden();
      }

      const change = watchlistChangeSchema.safeParse(await request.json());
      if (!change.success) {
        return HttpResponse.json({ message: change.error.message }, { status: 422 });
      }

      const scope = change.data.scope ?? watchlist.scope;
      if (!canChange(session, scope)) {
        return forbidden();
      }

      // A shared watchlist taken back as personal becomes the caller's own.
      const ownerId =
        scope === "personal" && watchlist.scope === "shared" ? session.user.id : watchlist.ownerId;
      const changed = { ...watchlist, ...change.data, ownerId };
      const duplicate = findDuplicateWatchlist(session, changed);
      if (duplicate !== null) {
        return alreadySaved(duplicate);
      }

      database.watchlists.splice(database.watchlists.indexOf(watchlist), 1, changed);
      return HttpResponse.json(publicWatchlistOf(changed));
    }),

    http.delete(route(`${apiRoutes.watchlists}/:watchlistId`), ({ params }) => {
      const session = currentSession();
      const watchlist = findVisibleWatchlist(session, String(params.watchlistId));
      if (watchlist === null) {
        return HttpResponse.json({ message: "Watchlist not found" }, { status: 404 });
      }

      if (!canChange(session, watchlist.scope)) {
        return forbidden();
      }

      database.watchlists.splice(database.watchlists.indexOf(watchlist), 1);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}

function forbidden() {
  return HttpResponse.json(
    { message: "Only those who manage shared watchlists can change them" },
    { status: 403 },
  );
}

function alreadySaved(duplicate: StoredWatchlist) {
  return HttpResponse.json(
    { message: `The filter is already saved as “${duplicate.name}”` },
    { status: 409 },
  );
}

export const handlers = createHandlers(env.VITE_MOCK_USER);
