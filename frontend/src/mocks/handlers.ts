// MSW handlers: the fake API at the HTTP boundary. They answer as one emulated user, VITE_MOCK_USER
// in the browser, so components, queries and forms run unchanged against the real API later.

import type { JsonBodyType } from "msw";
import { HttpResponse, http } from "msw";
import type { z } from "zod";
import {
  parseDocumentGrouping,
  parseDocumentSearchParams,
  parseDocumentSliceParams,
} from "@/api/documents";
import {
  cancellationRequestSchema,
  fieldCorrectionSchema,
  pageCountSchema,
  publicationSchema,
  reclassificationSchema,
  relinkSchema,
} from "@/api/iterations";
import { messageSubjectKindSchema, messageSubjectParams } from "@/api/messages";
import {
  approvalSchema,
  bulkApprovalSchema,
  declineSchema,
  parseProposalGrouping,
  parseProposalSearchParams,
  parseProposalSliceParams,
} from "@/api/proposal-review";
import { proposalDraftSchema, proposalLookupSchema } from "@/api/proposals";
import type { IterationAction, VerdictAction } from "@/api/routes";
import { apiRoutes } from "@/api/routes";
import { userSettingsChangeSchema } from "@/api/user-settings";
import {
  acceptanceSchema,
  denialSchema,
  parseValidationSearchParams,
  parseValidationSliceParams,
  revocationSchema,
} from "@/api/validations";
import { watchlistChangeSchema, watchlistDraftSchema, watchlistViewParam } from "@/api/watchlists";
import type { MockUserProfile } from "@/config/env";
import { env } from "@/config/env";
import type { Session } from "@/domain/entities";
import { watchlistViewSchema } from "@/domain/entities";
import { hasPermission } from "@/domain/permissions";
import { retryBatch } from "@/mocks/additions";
import type { StoredWatchlist } from "@/mocks/database";
import { database } from "@/mocks/database";
import { findDocumentDetail, queryDocuments } from "@/mocks/documents";
import {
  cancelIteration,
  correctField,
  enterPageCount,
  publishIteration,
  reclassifyIteration,
  relinkIteration,
} from "@/mocks/iterations";
import { messageChannels, prepareMessage } from "@/mocks/messages";
import type { Outcome } from "@/mocks/mutations";
import {
  approveProposal,
  bulkApproveProposals,
  canDecide,
  declineProposal,
  findProposalDetail,
  publicCustodyOf,
  queryProposals,
} from "@/mocks/proposal-review";
import {
  checkItem,
  proposableProjectsOf,
  proposalLimitOf,
  proposalSettings,
  submitProposal,
} from "@/mocks/proposals";
import { resolveSession } from "@/mocks/session";
import { changeUserSettings, userSettingsOf } from "@/mocks/user-settings";
import {
  acceptDefects,
  canReview,
  denyDefects,
  findValidationDetail,
  queryValidations,
  revokeAcceptance,
} from "@/mocks/validations";
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

  // An act on one record: its body parsed by the action's own schema, the outcome as a status.
  const recordAction = <Body, Value extends JsonBodyType>(
    path: string,
    schema: z.ZodType<Body>,
    act: (session: Session, id: string, body: Body) => Outcome<Value>,
    isAllowed: (session: Session) => boolean = () => true,
  ) =>
    http.post(route(path), async ({ params, request }) => {
      const session = currentSession();
      if (!isAllowed(session)) {
        return mayNotReview();
      }

      const body = schema.safeParse(await request.json());
      if (!body.success) {
        return HttpResponse.json({ message: body.error.message }, { status: 422 });
      }

      return outcomeResponse(act(session, String(params.id), body.data));
    });

  const iterationAction = <Body, Value extends JsonBodyType>(
    action: IterationAction,
    schema: z.ZodType<Body>,
    act: (session: Session, iterationId: string, body: Body) => Outcome<Value>,
  ) => recordAction(`${apiRoutes.iterations}/:id/${action}`, schema, act);

  const verdictAction = <Body, Value extends JsonBodyType>(
    action: VerdictAction,
    schema: z.ZodType<Body>,
    act: (session: Session, iterationId: string, body: Body) => Outcome<Value>,
  ) => recordAction(`${apiRoutes.validations}/:id/${action}`, schema, act, canReview);

  return [
    http.get(route(apiRoutes.session), () => HttpResponse.json(currentSession())),

    http.get(route(apiRoutes.userSettings), () =>
      HttpResponse.json(userSettingsOf(currentSession().user.id)),
    ),

    http.patch(route(apiRoutes.userSettings), async ({ request }) => {
      const change = userSettingsChangeSchema.safeParse(await request.json());
      if (!change.success) {
        return HttpResponse.json({ message: change.error.message }, { status: 422 });
      }

      return HttpResponse.json(changeUserSettings(currentSession().user.id, change.data));
    }),

    http.get(route(apiRoutes.users), () => HttpResponse.json(database.users)),
    http.get(route(apiRoutes.categories), () => HttpResponse.json(database.categories)),
    http.get(route(apiRoutes.projects), () => HttpResponse.json(database.projects)),
    http.get(route(apiRoutes.lists), () => HttpResponse.json(database.lists)),
    http.get(route(apiRoutes.batches), () => HttpResponse.json(database.batches)),

    http.post(route(`${apiRoutes.batches}/:batchId/retry`), ({ params }) =>
      outcomeResponse(retryBatch(currentSession(), String(params.batchId))),
    ),

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

    iterationAction("relink", relinkSchema, relinkIteration),
    iterationAction("reclassify", reclassificationSchema, reclassifyIteration),
    iterationAction("publish", publicationSchema, publishIteration),
    iterationAction("page-count", pageCountSchema, enterPageCount),
    iterationAction("field", fieldCorrectionSchema, correctField),
    iterationAction("cancel", cancellationRequestSchema, cancelIteration),

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

    http.get(route(apiRoutes.proposalCustodies), () => {
      if (!canDecide(currentSession())) {
        return mayNotDecide();
      }

      return HttpResponse.json(database.proposalCustodies.map(publicCustodyOf));
    }),

    http.get(route(apiRoutes.proposalReview), ({ request }) => {
      const session = currentSession();
      if (!canDecide(session)) {
        return mayNotDecide();
      }

      const params = new URL(request.url).searchParams;
      return HttpResponse.json(
        queryProposals(
          session,
          parseProposalSearchParams(params),
          parseProposalSliceParams(params),
          parseProposalGrouping(params),
        ),
      );
    }),

    http.post(
      route(`${apiRoutes.proposalReview}/batches/:batchId/approve`),
      async ({ params, request }) => {
        const session = currentSession();
        if (!canDecide(session)) {
          return mayNotDecide();
        }

        const bulk = bulkApprovalSchema.safeParse(await request.json());
        if (!bulk.success) {
          return HttpResponse.json({ message: bulk.error.message }, { status: 422 });
        }

        return outcomeResponse(bulkApproveProposals(session, String(params.batchId), bulk.data));
      },
    ),

    http.get(route(`${apiRoutes.proposalReview}/:documentId`), ({ params }) => {
      const session = currentSession();
      if (!canDecide(session)) {
        return mayNotDecide();
      }

      const detail = findProposalDetail(session, String(params.documentId));
      if (detail === null) {
        return HttpResponse.json({ message: "Proposal not found" }, { status: 404 });
      }

      return HttpResponse.json(detail);
    }),

    http.post(
      route(`${apiRoutes.proposalReview}/:documentId/approve`),
      async ({ params, request }) => {
        const session = currentSession();
        if (!canDecide(session)) {
          return mayNotDecide();
        }

        const approval = approvalSchema.safeParse(await request.json());
        if (!approval.success) {
          return HttpResponse.json({ message: approval.error.message }, { status: 422 });
        }

        return outcomeResponse(approveProposal(session, String(params.documentId), approval.data));
      },
    ),

    http.post(
      route(`${apiRoutes.proposalReview}/:documentId/decline`),
      async ({ params, request }) => {
        const session = currentSession();
        if (!canDecide(session)) {
          return mayNotDecide();
        }

        const decline = declineSchema.safeParse(await request.json());
        if (!decline.success) {
          return HttpResponse.json({ message: decline.error.message }, { status: 422 });
        }

        return outcomeResponse(declineProposal(session, String(params.documentId), decline.data));
      },
    ),

    http.get(route(apiRoutes.validations), ({ request }) => {
      const session = currentSession();
      if (!canReview(session)) {
        return mayNotReview();
      }

      const params = new URL(request.url).searchParams;
      return HttpResponse.json(
        queryValidations(
          session,
          parseValidationSearchParams(params),
          parseValidationSliceParams(params),
        ),
      );
    }),

    http.get(route(`${apiRoutes.validations}/:iterationId`), ({ params }) => {
      const session = currentSession();
      if (!canReview(session)) {
        return mayNotReview();
      }

      const detail = findValidationDetail(session, String(params.iterationId));
      if (detail === null) {
        return HttpResponse.json({ message: "Nothing here waits for a verdict" }, { status: 404 });
      }

      return HttpResponse.json(detail);
    }),

    verdictAction("accept", acceptanceSchema, acceptDefects),
    verdictAction("deny", denialSchema, denyDefects),
    verdictAction("revoke", revocationSchema, revokeAcceptance),

    http.get(route(apiRoutes.messageChannels), () => HttpResponse.json(messageChannels())),

    http.get(route(apiRoutes.messageHandOff), ({ request }) => {
      const params = new URL(request.url).searchParams;
      const kind = messageSubjectKindSchema.safeParse(params.get(messageSubjectParams.kind));
      const id = params.get(messageSubjectParams.id);
      if (!kind.success || id === null || id === "") {
        return HttpResponse.json({ message: "Say what the message is about" }, { status: 422 });
      }

      return outcomeResponse(prepareMessage(currentSession(), { kind: kind.data, id }));
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

function mayNotDecide() {
  return HttpResponse.json({ message: "You may not decide proposals" }, { status: 403 });
}

function mayNotReview() {
  return HttpResponse.json({ message: "You may not review documents" }, { status: 403 });
}

function outcomeResponse<Value extends JsonBodyType>(outcome: Outcome<Value>) {
  if ("refusal" in outcome) {
    return HttpResponse.json(
      { message: outcome.refusal.message },
      { status: outcome.refusal.status },
    );
  }

  return HttpResponse.json(outcome.value);
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
