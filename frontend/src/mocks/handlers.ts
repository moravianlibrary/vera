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
  pageCountSchema,
  publicationSchema,
  recheckSchema,
  reclassificationSchema,
} from "@/api/iterations";
import {
  generationRequestSchema,
  listDraftSchema,
  notDigitizableRequestSchema,
  parseListSearchParams,
  parseListSliceParams,
  parsePoolSearchParams,
} from "@/api/lists";
import { messageSubjectKindSchema, messageSubjectParams } from "@/api/messages";
import {
  projectApprovalSchema,
  projectDraftSchema,
  projectMembersSchema,
  projectRejectionSchema,
} from "@/api/projects";
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
  parseValidationGrouping,
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
  enterPageCount,
  publishIteration,
  recheckIteration,
  reclassifyIteration,
} from "@/mocks/iterations";
import { canGenerate, enabledGenerators, generateDraft } from "@/mocks/list-generation";
import {
  canBuildLists,
  canReadLists,
  createList,
  deleteList,
  findListDetail,
  markListDone,
  markNotDigitizable,
  previewDeletion,
  previewMarkDone,
  queryLists,
  queryPool,
  saveList,
} from "@/mocks/lists";
import { messageChannels, prepareMessage } from "@/mocks/messages";
import type { Outcome } from "@/mocks/mutations";
import { invalidResponse, problemResponse } from "@/mocks/problem";
import {
  approveProject,
  canReadProjects,
  createProject,
  deleteProject,
  findProjectDetail,
  listMemberGroups,
  previewDecision,
  queryProjectIndex,
  rejectProject,
  saveProject,
  saveProjectMembers,
} from "@/mocks/projects";
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
        return invalidResponse(body.error);
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
        return invalidResponse(change.error);
      }

      return HttpResponse.json(changeUserSettings(currentSession().user.id, change.data));
    }),

    http.get(route(apiRoutes.users), () => HttpResponse.json(database.users)),
    http.get(route(apiRoutes.categories), () => HttpResponse.json(database.categories)),
    http.get(route(apiRoutes.projects), () => HttpResponse.json(database.projects)),
    http.get(route(apiRoutes.groups), () => HttpResponse.json(listMemberGroups())),

    // Before `/:projectId`, so the index is not read as a project named "overview".
    http.get(route(apiRoutes.projectIndex), () => {
      const session = currentSession();
      if (!canReadProjects(session)) {
        return mayNotReadProjects();
      }

      return HttpResponse.json(queryProjectIndex(session));
    }),

    http.get(route(`${apiRoutes.projects}/:projectId`), ({ params }) => {
      const session = currentSession();
      if (!canReadProjects(session)) {
        return mayNotReadProjects();
      }

      const detail = findProjectDetail(session, String(params.projectId));
      if (detail === null) {
        return problemResponse({ status: 404, message: "Project not found" });
      }

      return HttpResponse.json(detail);
    }),

    http.post(route(apiRoutes.projects), async ({ request }) => {
      const draft = projectDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return invalidResponse(draft.error);
      }

      const outcome = createProject(currentSession(), draft.data);
      if ("refusal" in outcome) {
        return problemResponse(outcome.refusal);
      }

      return HttpResponse.json(outcome.value, { status: 201 });
    }),

    http.put(route(`${apiRoutes.projects}/:projectId`), async ({ params, request }) => {
      const draft = projectDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return invalidResponse(draft.error);
      }

      return outcomeResponse(saveProject(currentSession(), String(params.projectId), draft.data));
    }),

    http.put(route(`${apiRoutes.projects}/:projectId/members`), async ({ params, request }) => {
      const members = projectMembersSchema.safeParse(await request.json());
      if (!members.success) {
        return invalidResponse(members.error);
      }

      return outcomeResponse(
        saveProjectMembers(currentSession(), String(params.projectId), members.data),
      );
    }),

    http.get(route(`${apiRoutes.projects}/:projectId/decision`), ({ params }) =>
      outcomeResponse(previewDecision(currentSession(), String(params.projectId))),
    ),

    http.post(route(`${apiRoutes.projects}/:projectId/approve`), async ({ params, request }) => {
      const approval = projectApprovalSchema.safeParse(await request.json());
      if (!approval.success) {
        return invalidResponse(approval.error);
      }

      return outcomeResponse(
        approveProject(currentSession(), String(params.projectId), approval.data),
      );
    }),

    http.post(route(`${apiRoutes.projects}/:projectId/reject`), async ({ params, request }) => {
      const rejection = projectRejectionSchema.safeParse(await request.json());
      if (!rejection.success) {
        return invalidResponse(rejection.error);
      }

      return outcomeResponse(
        rejectProject(currentSession(), String(params.projectId), rejection.data),
      );
    }),

    http.delete(route(`${apiRoutes.projects}/:projectId`), ({ params }) => {
      const outcome = deleteProject(currentSession(), String(params.projectId));
      if ("refusal" in outcome) {
        return problemResponse(outcome.refusal);
      }

      return new HttpResponse(null, { status: 204 });
    }),
    http.get(route(apiRoutes.lists), () => HttpResponse.json(database.lists)),
    http.get(route(apiRoutes.batches), () => HttpResponse.json(database.batches)),

    http.get(route(apiRoutes.digitizationLists), ({ request }) => {
      const session = currentSession();
      if (!canReadLists(session)) {
        return mayNotReadLists();
      }

      const params = new URL(request.url).searchParams;
      return HttpResponse.json(
        queryLists(session, parseListSearchParams(params), parseListSliceParams(params)),
      );
    }),

    // Before `/:listId`, so the pool is not read as a list named "pool".
    http.get(route(apiRoutes.digitizationListPool), ({ request }) => {
      if (!canBuildLists(currentSession())) {
        return problemResponse({ status: 403, message: "You may not build lists" });
      }

      const params = new URL(request.url).searchParams;
      return HttpResponse.json(
        queryPool(parsePoolSearchParams(params), parseListSliceParams(params)),
      );
    }),

    http.get(route(apiRoutes.listGenerators), () => {
      if (!canGenerate(currentSession())) {
        return problemResponse({ status: 403, message: "You may not build lists" });
      }

      return HttpResponse.json(enabledGenerators());
    }),

    http.post(route(apiRoutes.listGeneration), async ({ request }) => {
      const generation = generationRequestSchema.safeParse(await request.json());
      if (!generation.success) {
        return invalidResponse(generation.error);
      }

      return outcomeResponse(generateDraft(currentSession(), generation.data));
    }),

    http.get(route(`${apiRoutes.digitizationLists}/:listId`), ({ params }) => {
      const session = currentSession();
      if (!canReadLists(session)) {
        return mayNotReadLists();
      }

      const detail = findListDetail(session, String(params.listId));
      if (detail === null) {
        return problemResponse({ status: 404, message: "List not found" });
      }

      return HttpResponse.json(detail);
    }),

    http.post(route(apiRoutes.digitizationLists), async ({ request }) => {
      const draft = listDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return invalidResponse(draft.error);
      }

      const outcome = createList(currentSession(), draft.data);
      if ("refusal" in outcome) {
        return problemResponse(outcome.refusal);
      }

      return HttpResponse.json(outcome.value, { status: 201 });
    }),

    http.put(route(`${apiRoutes.digitizationLists}/:listId`), async ({ params, request }) => {
      const draft = listDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return invalidResponse(draft.error);
      }

      return outcomeResponse(saveList(currentSession(), String(params.listId), draft.data));
    }),

    http.get(route(`${apiRoutes.digitizationLists}/:listId/done`), ({ params }) =>
      outcomeResponse(previewMarkDone(currentSession(), String(params.listId))),
    ),

    http.post(route(`${apiRoutes.digitizationLists}/:listId/done`), ({ params }) =>
      outcomeResponse(markListDone(currentSession(), String(params.listId))),
    ),

    http.get(route(`${apiRoutes.digitizationLists}/:listId/deletion`), ({ params }) =>
      outcomeResponse(previewDeletion(currentSession(), String(params.listId))),
    ),

    http.delete(route(`${apiRoutes.digitizationLists}/:listId`), ({ params }) => {
      const outcome = deleteList(currentSession(), String(params.listId));
      if ("refusal" in outcome) {
        return problemResponse(outcome.refusal);
      }

      return new HttpResponse(null, { status: 204 });
    }),

    http.post(
      route(`${apiRoutes.digitizationLists}/:listId/items/:iterationId/not-digitizable`),
      async ({ params, request }) => {
        const body = notDigitizableRequestSchema.safeParse(await request.json());
        if (!body.success) {
          return invalidResponse(body.error);
        }

        return outcomeResponse(
          markNotDigitizable(
            currentSession(),
            String(params.listId),
            String(params.iterationId),
            body.data,
          ),
        );
      },
    ),

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
        return problemResponse({ status: 404, message: "Document not found" });
      }

      return HttpResponse.json(detail);
    }),

    iterationAction("reclassify", reclassificationSchema, reclassifyIteration),
    iterationAction("publish", publicationSchema, publishIteration),
    iterationAction("page-count", pageCountSchema, enterPageCount),
    iterationAction("recheck", recheckSchema, recheckIteration),
    iterationAction("cancel", cancellationRequestSchema, cancelIteration),

    http.get(route(apiRoutes.proposalSettings), () => HttpResponse.json(proposalSettings)),

    http.post(route(apiRoutes.proposalLookup), async ({ request }) => {
      const session = currentSession();
      if (!hasPermission(session, "request.create")) {
        return problemResponse({ status: 403, message: "You may not propose" });
      }

      const lookup = proposalLookupSchema.safeParse(await request.json());
      if (!lookup.success) {
        return invalidResponse(lookup.error);
      }

      return HttpResponse.json(lookup.data.items.map((item) => checkItem(session, item)));
    }),

    http.post(route(apiRoutes.proposals), async ({ request }) => {
      const session = currentSession();
      const draft = proposalDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return invalidResponse(draft.error);
      }

      const isApprovalRefused =
        draft.data.approval !== null && !hasPermission(session, "request.decide");
      if (!hasPermission(session, "request.create") || isApprovalRefused) {
        return problemResponse({ status: 403, message: "You may not propose this" });
      }

      if (draft.data.items.length > proposalLimitOf(session)) {
        return problemResponse({
          status: 422,
          message: `At most ${proposalLimitOf(session)} items at once`,
        });
      }

      const isProjectRefused =
        draft.data.projectId !== null &&
        !proposableProjectsOf(session).some((project) => project.id === draft.data.projectId);
      if (isProjectRefused) {
        return problemResponse({
          status: 422,
          message: "Only a member proposes into a project, and not into a rejected one",
        });
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
          return invalidResponse(bulk.error);
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
        return problemResponse({ status: 404, message: "Proposal not found" });
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
          return invalidResponse(approval.error);
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
          return invalidResponse(decline.error);
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
          parseValidationGrouping(params),
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
        return problemResponse({ status: 404, message: "Nothing here waits for a verdict" });
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
        return problemResponse({ status: 422, message: "Say what the message is about" });
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
        return invalidResponse(draft.error);
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
        return problemResponse({ status: 404, message: "Watchlist not found" });
      }

      if (!canChange(session, watchlist.scope)) {
        return forbidden();
      }

      const change = watchlistChangeSchema.safeParse(await request.json());
      if (!change.success) {
        return invalidResponse(change.error);
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
        return problemResponse({ status: 404, message: "Watchlist not found" });
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
  return problemResponse({ status: 403, message: "You may not decide proposals" });
}

function mayNotReadLists() {
  return problemResponse({ status: 403, message: "You may not read digitization lists" });
}

function mayNotReadProjects() {
  return problemResponse({ status: 403, message: "You may not read projects" });
}

function mayNotReview() {
  return problemResponse({ status: 403, message: "You may not review documents" });
}

function outcomeResponse<Value extends JsonBodyType>(outcome: Outcome<Value>) {
  if ("refusal" in outcome) {
    return problemResponse(outcome.refusal);
  }

  return HttpResponse.json(outcome.value);
}

function forbidden() {
  return problemResponse({
    status: 403,
    message: "Only those who manage shared watchlists can change them",
  });
}

function alreadySaved(duplicate: StoredWatchlist) {
  return problemResponse({
    status: 409,
    message: `The filter is already saved as “${duplicate.name}”`,
    code: "watchlist.already_saved",
  });
}

export const handlers = createHandlers(env.VITE_MOCK_USER);
