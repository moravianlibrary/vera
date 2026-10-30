// MSW handlers: the fake API at the HTTP boundary. They answer as one emulated user, VITE_MOCK_USER
// in the browser, so components, queries and forms run unchanged against the real API later.

import {
  custodyMembersSchema,
  groupMembersSchema,
  handRolesSchema,
  identityDefaultRoleSchema,
  identityLinkSchema,
  localAccountSchema,
  recordDraftSchema,
  roleDraftSchema,
  userGroupsSchema,
} from "@vera/contract/access";
import {
  categoryDraftSchema,
  custodyDraftSchema,
  refineDraftSchema,
} from "@vera/contract/categories";
import {
  parseDocumentGrouping,
  parseDocumentSearchParams,
  parseDocumentSliceParams,
} from "@vera/contract/documents";
import { hookDraftSchema, hookPauseSchema } from "@vera/contract/hooks";
import {
  intentionDraftSchema,
  intentionPreviewRequestSchema,
  intentionTemplateDraftSchema,
} from "@vera/contract/intentions";
import {
  cancellationRequestSchema,
  overruleSchema,
  pageCountSchema,
  publicationSchema,
  recheckSchema,
  reclassificationSchema,
  resumeSchema,
} from "@vera/contract/iterations";
import {
  generationRequestSchema,
  listDraftSchema,
  listReadingRequestSchema,
  notDigitizableRequestSchema,
  parseListSearchParams,
  parseListSliceParams,
  parsePoolSearchParams,
} from "@vera/contract/lists";
import {
  emailOnlySchema,
  localLoginSchema,
  passwordResetSchema,
  signUpSchema,
  tokenSchema,
} from "@vera/contract/login";
import {
  messageSubjectKindSchema,
  messageSubjectParams,
  sendMessageBodySchema,
} from "@vera/contract/messages";
import {
  mixDraftSchema,
  mixSetChangeSchema,
  mixSnapshotDraftSchema,
} from "@vera/contract/mix-catalog";
import { notificationChoicesSchema } from "@vera/contract/notification-preferences";
import { instanceDraftSchema, newInstanceSchema } from "@vera/contract/plugins";
import {
  parseProjectSearchParams,
  projectApprovalSchema,
  projectDraftSchema,
  projectMembersSchema,
  projectRejectionSchema,
} from "@vera/contract/projects";
import {
  bulkPropertyEntrySchema,
  newPropertySchema,
  propertyEntrySchema,
} from "@vera/contract/properties";
import {
  proposalDraftSchema,
  proposalLookupSchema,
  recordLinkSchema,
} from "@vera/contract/proposals";
import { pushSubscriptionSchema } from "@vera/contract/push";
import {
  approvalSchema,
  bulkApprovalSchema,
  declineSchema,
  parseRequestGrouping,
  parseRequestSearchParams,
  parseRequestSliceParams,
} from "@vera/contract/requests";
import type { IterationAction, VerdictAction } from "@vera/contract/routes";
import { apiRoutes } from "@vera/contract/routes";
import {
  newScheduleSchema,
  pauseRequestSchema,
  scheduleDraftSchema,
  timelineRangeSchema,
} from "@vera/contract/schedules";
import { parseRunSearchParams, retentionSchema } from "@vera/contract/tasks";
import { userSettingsChangeSchema } from "@vera/contract/user-settings";
import {
  acceptanceSchema,
  denialSchema,
  parseValidationGrouping,
  parseValidationSearchParams,
  parseValidationSliceParams,
  revocationSchema,
} from "@vera/contract/validations";
import {
  isSameWatchlistFilter,
  watchlistChangeSchema,
  watchlistDraftSchema,
  watchlistModeParam,
  watchlistReachRequestSchema,
  watchlistViewerChangeSchema,
  watchlistViewParam,
} from "@vera/contract/watchlists";
import type { Session } from "@vera/domain/entities";
import { watchlistViewSchema } from "@vera/domain/entities";
import { canOpenMyDocuments, hasPermission } from "@vera/domain/permissions";
import { propertyDraftSchema } from "@vera/domain/properties";
import type { JsonBodyType } from "msw";
import { HttpResponse, http } from "msw";
import type { z } from "zod";
import type { MockUserProfile } from "@/config/env";
import { env } from "@/config/env";
import {
  accessIndex,
  canReadAccess,
  createCustody,
  createGroup,
  createLocalAccount,
  createRole,
  custodyImpact,
  deleteCustody,
  deleteRole,
  linkIdentity,
  restoreUser,
  roleImpact,
  saveRole as saveAccessRole,
  saveCustody,
  saveGroup,
  setCustodyMembers,
  setGroupMembers,
  setHandRoles,
  setIdentityDefaultRole,
  setUserGroups,
  suspendUser,
  unlinkIdentity,
} from "@/mocks/access";
import { retryBatch } from "@/mocks/additions";
import { servedBatches } from "@/mocks/batches";
import {
  canReadCategories,
  categoryImpact,
  createCategory,
  deleteCategory,
  queryCategoryIndex,
  refineCategory,
  saveCategory,
  saveCategoryCustody,
} from "@/mocks/categories";
import type { StoredWatchlist } from "@/mocks/database";
import { database } from "@/mocks/database";
import { findDocumentDetail, queryDocuments } from "@/mocks/documents";
import {
  canReadHooks,
  createHook,
  deleteHook,
  discardDelivery,
  hookIndex,
  pauseHook,
  previewHook,
  resumeHook,
  retryAllDeliveries,
  retryDelivery,
  saveHook,
  sendNow as sendHookNow,
  sendTest as sendHookTest,
} from "@/mocks/hooks";
import { listShapes, previewCorrection, readList } from "@/mocks/intention-lists";
import {
  archiveIntention,
  canReadIntentions,
  createIntention,
  createIntentionTemplate,
  deleteIntention,
  previewIntention,
  previewIntentionDeletion,
  queryIntentionIndex,
  saveIntention,
  saveIntentionTemplate,
  unarchiveIntention,
} from "@/mocks/intentions";
import {
  cancelIteration,
  enterPageCount,
  makeIterationLinkPrimary,
  overruleRestriction,
  publishIteration,
  recheckIteration,
  reclassifyIteration,
  removeIterationLink,
  replaceIterationLink,
  resumeIteration,
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
  startListNow,
} from "@/mocks/lists";
import { messageChannels, prepareMessage, sendMessage } from "@/mocks/messages";
import {
  archiveMixRecord,
  createMixRecord,
  deleteMixRecord,
  getMixRecord,
  listMixRecords,
  makeMixPrimary,
  saveMixRecordSet,
  snapshotMixRecord,
} from "@/mocks/mix-catalog";
import { findIntentionMix } from "@/mocks/mixes";
import type { Outcome } from "@/mocks/mutations";
import {
  changePublicNotificationChoices,
  publicNotificationChoices,
} from "@/mocks/notification-tokens";
import { instanceSummaries } from "@/mocks/plugin-instances";
import {
  canReadPlugins,
  createInstance,
  deleteInstance,
  installUpload,
  instanceImpact,
  instanceUpgrade,
  pluginIndex,
  readUpload,
  runInstanceNow,
  saveInstance,
  setInstanceEnabled,
  upgradeInstance,
} from "@/mocks/plugins";
import { invalidResponse, problemResponse } from "@/mocks/problem";
import {
  approveProject,
  canReadProjects,
  createProject,
  deleteProject,
  findProjectDetail,
  listMemberGroups,
  previewDecision,
  previewProjectChange,
  queryProjectIndex,
  rejectProject,
  saveProject,
  saveProjectMembers,
} from "@/mocks/projects";
import {
  createProperty,
  deleteProperty,
  enterPropertyValue,
  enterPropertyValues,
  propertyImpact,
  propertyIndex,
  saveProperty,
} from "@/mocks/properties";
import {
  canSubmitRateLimited,
  checkItem,
  getRateLimitStatus,
  proposableProjectsOf,
  proposalLimitOf,
  proposalSettingsOf,
  submitProposal,
  submittableProposalItemCount,
} from "@/mocks/proposals";
import { pushDevicesOf, registerPushDevice } from "@/mocks/push";
import {
  approveProposal,
  bulkApproveProposals,
  canDecide,
  canReadRequests,
  declineProposal,
  findRequestDetail,
  publicCustodyOf,
  queryRequests,
  withdrawAsk,
} from "@/mocks/requests";
import {
  canReadSchedules,
  createSchedule,
  deleteSchedule,
  pauseSchedule,
  querySchedules,
  resumeSchedule,
  runScheduleNow,
  saveSchedule,
} from "@/mocks/schedules";
import { accessUserOf, isSuspendedUser, resolveSession } from "@/mocks/session";
import {
  confirmEmail,
  requestPasswordReset,
  resetPassword,
  sendVerificationAgain,
  signUp,
} from "@/mocks/sign-up";
import {
  cancelRun,
  canReadRuns,
  findRunDetail,
  queryRuns,
  runAgain,
  runLogText,
  runningRuns,
  saveRetention,
} from "@/mocks/tasks";
import { changeUserSettings, userSettingsOf } from "@/mocks/user-settings";
import {
  acceptDefects,
  canReview,
  denyDefects,
  findValidationDetail,
  queryValidations,
  revokeAcceptance,
} from "@/mocks/validations";
import { watchlistChannelsOf } from "@/mocks/watchlist-channels";
import {
  flushWatchlistChat,
  flushWatchlistMail,
  noteSystemWatchlistChange,
} from "@/mocks/watchlist-delivery";
import { storeWatchlistViewers } from "@/mocks/watchlist-viewer-store";
import {
  audienceReachOf,
  canChange,
  canOpenView,
  findChangeableWatchlist,
  findDuplicateWatchlist,
  findVisibleWatchlist,
  isValidWatchlistFilter,
  publicWatchlistOf,
  viewerOf,
  visibleWatchlists,
  watchlistReachOf,
} from "@/mocks/watchlists";
import { readBarcode, readPhoto, readRecordLink, searchCatalogs } from "@/mocks/ways-in";

const route = (path: string) => `${env.VITE_API_BASE_URL}${path}`;

export function createHandlers(profile: MockUserProfile) {
  const currentSession = (): Session => resolveSession(profile);
  const signedOutKey = `vera.mock.signed-out.${profile}`;

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

  // A write on Users & Groups: its body parsed by its own schema, the outcome as a status.
  const accessWrite = <Body, Value extends JsonBodyType>(
    method: "post" | "put",
    path: string,
    schema: z.ZodType<Body>,
    act: (session: Session, id: string, body: Body) => Outcome<Value>,
  ) =>
    http[method](route(path), async ({ params, request }) => {
      const body = schema.safeParse(await request.json());
      if (!body.success) {
        return invalidResponse(body.error);
      }

      return outcomeResponse(act(currentSession(), String(params.id ?? ""), body.data));
    });

  const accessDelete = (path: string, act: (session: Session, id: string) => Outcome<null>) =>
    http.delete(route(path), ({ params }) => {
      const outcome = act(currentSession(), String(params.id));
      return "refusal" in outcome
        ? problemResponse(outcome.refusal)
        : new HttpResponse(null, { status: 204 });
    });

  const enabledIdentity = (instanceId: string) =>
    database.pluginInstances.find(
      (instance) =>
        instance.id === instanceId && instance.isEnabled && instance.settings?.kind === "Identity",
    );

  return [
    // A suspended person's login is refused (ACCESS-suspend).
    http.get(route(apiRoutes.session), () =>
      window.sessionStorage.getItem(signedOutKey) === "1" ||
      isSuspendedUser(currentSession().user.id)
        ? new HttpResponse(null, { status: 401 })
        : HttpResponse.json(currentSession()),
    ),
    http.delete(route(apiRoutes.sessionLogout), () => {
      window.sessionStorage.setItem(signedOutKey, "1");
      return new HttpResponse(null, { status: 204 });
    }),
    // ACCESS-login-page: the enabled Identity instances, in their order. Local accounts (pt22)
    // log in with a form; the others redirect.
    http.get(route(apiRoutes.login), () =>
      HttpResponse.json(
        database.pluginInstances
          .flatMap((instance) =>
            instance.isEnabled && instance.settings?.kind === "Identity"
              ? [{ instance, order: instance.settings.order, label: instance.settings.label }]
              : [],
          )
          .sort((first, second) => first.order - second.order)
          .map(({ instance, label }) => ({
            instanceId: instance.id,
            label,
            entry: instance.implementationId === "pt22" ? "form" : "redirect",
            canSignUp:
              instance.implementationId === "pt22" &&
              instance.configuration.signup === "on" &&
              instance.configuration.mail_channel !== undefined,
            canResetPassword:
              instance.implementationId === "pt22" &&
              instance.configuration.mail_channel !== undefined,
          })),
      ),
    ),
    // The mock signs in its one profile through any form instance with a password typed; it
    // checks no password, as it has none to check.
    http.post(route(`${apiRoutes.login}/:instanceId`), async ({ params, request }) => {
      const instance = enabledIdentity(String(params.instanceId));
      if (instance === undefined || instance.implementationId !== "pt22") {
        return new HttpResponse(null, { status: 404 });
      }

      const credentials = localLoginSchema.safeParse(await request.json());
      if (!credentials.success) {
        return new HttpResponse(null, { status: 401 });
      }

      window.sessionStorage.removeItem(signedOutKey);
      return new HttpResponse(null, { status: 204 });
    }),
    // Mock only: stands in for a provider's redirect and its callback.
    http.post(route(`${apiRoutes.login}/:instanceId/mock`), ({ params }) => {
      const instance = enabledIdentity(String(params.instanceId));
      if (instance === undefined || instance.implementationId === "pt22") {
        return new HttpResponse(null, { status: 404 });
      }

      window.sessionStorage.removeItem(signedOutKey);
      return new HttpResponse(null, { status: 204 });
    }),

    http.post(route(`${apiRoutes.signUp}/:instanceId`), async ({ params, request }) => {
      const parsed = signUpSchema.safeParse(await request.json());
      if (!parsed.success) return invalidResponse(parsed.error);
      const result = signUp(String(params.instanceId), parsed.data);
      return "refusal" in result
        ? problemResponse(result.refusal)
        : new HttpResponse(null, { status: 202 });
    }),
    // A confirm route before its :instanceId sibling, which would take "confirm" as an id.
    http.post(route(`${apiRoutes.emailVerification}/confirm`), async ({ request }) => {
      const parsed = tokenSchema.safeParse(await request.json());
      if (!parsed.success) return invalidResponse(parsed.error);
      const result = confirmEmail(parsed.data.token);
      return "refusal" in result
        ? problemResponse(result.refusal)
        : HttpResponse.json(result.value);
    }),
    http.post(route(`${apiRoutes.emailVerification}/:instanceId`), async ({ params, request }) => {
      const parsed = emailOnlySchema.safeParse(await request.json());
      if (!parsed.success) return invalidResponse(parsed.error);
      sendVerificationAgain(String(params.instanceId), parsed.data.email);
      return new HttpResponse(null, { status: 202 });
    }),
    http.post(route(`${apiRoutes.passwordReset}/confirm`), async ({ request }) => {
      const parsed = passwordResetSchema.safeParse(await request.json());
      if (!parsed.success) return invalidResponse(parsed.error);
      const result = resetPassword(parsed.data);
      return "refusal" in result
        ? problemResponse(result.refusal)
        : new HttpResponse(null, { status: 204 });
    }),
    http.post(route(`${apiRoutes.passwordReset}/:instanceId`), async ({ params, request }) => {
      const parsed = emailOnlySchema.safeParse(await request.json());
      if (!parsed.success) return invalidResponse(parsed.error);
      requestPasswordReset(String(params.instanceId), parsed.data.email);
      return new HttpResponse(null, { status: 202 });
    }),
    http.get(route("/_mock/system-mail"), () =>
      HttpResponse.json([...database.systemMail].toReversed()),
    ),

    // WATCH-delivery: the channels a watchlist can reach this person through, besides push.
    http.get(route(apiRoutes.watchlistChannels), () =>
      HttpResponse.json(
        watchlistChannelsOf(currentSession().user.id).map(
          ({ interface: _interface, ...channel }) => channel,
        ),
      ),
    ),

    http.get(route(apiRoutes.sessionAccount), () =>
      HttpResponse.json(accessUserOf(currentSession().user)),
    ),

    http.get(route(apiRoutes.userSettings), () =>
      HttpResponse.json(userSettingsOf(currentSession().user.id)),
    ),

    http.get(route(apiRoutes.pushDevices), () =>
      HttpResponse.json(pushDevicesOf(currentSession().user.id)),
    ),
    http.post(route(apiRoutes.pushDevices), async ({ request }) => {
      const subscription = pushSubscriptionSchema.safeParse(await request.json());
      return subscription.success
        ? HttpResponse.json(registerPushDevice(currentSession().user.id, subscription.data))
        : invalidResponse(subscription.error);
    }),

    http.get(route(apiRoutes.notificationHooks), () =>
      HttpResponse.json(
        database.hooks.flatMap((hook) =>
          hook.recipientPreference == null
            ? []
            : [
                {
                  id: hook.id,
                  label: hook.recipientPreference.label,
                  event: hook.event,
                  defaultEnabled: hook.recipientPreference.defaultEnabled,
                  isActive: hook.state === "active",
                },
              ],
        ),
      ),
    ),

    http.get(route(`${apiRoutes.notificationPreferences}/:token`), ({ params }) => {
      const choices = publicNotificationChoices(String(params.token));
      return choices === null
        ? problemResponse({ status: 404, message: "This notification link has expired" })
        : HttpResponse.json(choices);
    }),

    http.patch(
      route(`${apiRoutes.notificationPreferences}/:token`),
      async ({ params, request }) => {
        const body = (await request.json()) as { notifications?: unknown };
        const parsed = notificationChoicesSchema.safeParse(body.notifications);
        if (!parsed.success) return invalidResponse(parsed.error);
        const choices = changePublicNotificationChoices(String(params.token), parsed.data);
        return choices === null
          ? problemResponse({ status: 404, message: "This notification link has expired" })
          : HttpResponse.json(choices);
      },
    ),

    http.patch(route(apiRoutes.userSettings), async ({ request }) => {
      const change = userSettingsChangeSchema.safeParse(await request.json());
      if (!change.success) {
        return invalidResponse(change.error);
      }

      return HttpResponse.json(changeUserSettings(currentSession().user.id, change.data));
    }),

    http.get(route(apiRoutes.users), () => HttpResponse.json(database.users)),

    // DOC-property: the definitions the caller reads, and those who define them write them.
    http.get(route(apiRoutes.properties), () => HttpResponse.json(propertyIndex(currentSession()))),
    accessWrite("post", apiRoutes.properties, newPropertySchema, (session, _id, property) =>
      createProperty(session, property.key, property.draft),
    ),
    accessWrite("put", `${apiRoutes.properties}/:id`, propertyDraftSchema, saveProperty),
    http.get(route(`${apiRoutes.properties}/:id/impact`), ({ params }) =>
      outcomeResponse(propertyImpact(currentSession(), String(params.id))),
    ),
    accessDelete(`${apiRoutes.properties}/:id`, deleteProperty),
    // DOC-property-hand: one record's value, or the same value on a selection.
    http.put(
      route(`${apiRoutes.documents}/:documentId/properties/:key`),
      async ({ params, request }) => {
        const body = propertyEntrySchema.safeParse(await request.json());
        if (!body.success) {
          return invalidResponse(body.error);
        }

        return outcomeResponse(
          enterPropertyValue(
            currentSession(),
            String(params.documentId),
            String(params.key),
            body.data,
          ),
        );
      },
    ),
    http.post(route(`${apiRoutes.documents}/properties/:key`), async ({ params, request }) => {
      const body = bulkPropertyEntrySchema.safeParse(await request.json());
      if (!body.success) {
        return invalidResponse(body.error);
      }

      const { documentIds, ...entry } = body.data;
      return outcomeResponse(
        enterPropertyValues(currentSession(), documentIds, String(params.key), entry),
      );
    }),

    http.get(route(apiRoutes.hooks), () =>
      canReadHooks(currentSession())
        ? HttpResponse.json(hookIndex())
        : problemResponse({ status: 403, message: "You may not read hooks" }),
    ),
    accessWrite("post", apiRoutes.hooks, hookDraftSchema, (session, _id, draft) =>
      createHook(session, draft),
    ),
    accessWrite("put", `${apiRoutes.hooks}/:id`, hookDraftSchema, saveHook),
    accessDelete(`${apiRoutes.hooks}/:id`, deleteHook),
    accessWrite("post", `${apiRoutes.hooks}/:id/pause`, hookPauseSchema, (session, id, body) =>
      pauseHook(session, id, body.reason),
    ),
    http.post(route(`${apiRoutes.hooks}/:id/resume`), ({ params }) =>
      outcomeResponse(resumeHook(currentSession(), String(params.id))),
    ),
    http.post(route(`${apiRoutes.hooks}/:id/retry`), ({ params }) =>
      outcomeResponse(retryAllDeliveries(currentSession(), String(params.id))),
    ),
    http.post(route(`${apiRoutes.hooks}/:id/send-now`), ({ params }) =>
      outcomeResponse(sendHookNow(currentSession(), String(params.id))),
    ),
    http.post(route(`${apiRoutes.hooks}/deliveries/:id/retry`), ({ params }) =>
      outcomeResponse(retryDelivery(currentSession(), String(params.id))),
    ),
    http.post(route(`${apiRoutes.hooks}/deliveries/:id/discard`), ({ params }) =>
      outcomeResponse(discardDelivery(currentSession(), String(params.id))),
    ),
    accessWrite("post", apiRoutes.hookPreview, hookDraftSchema, (session, _id, draft) =>
      previewHook(session, draft),
    ),
    accessWrite("post", `${apiRoutes.hooks}/test`, hookDraftSchema, (session, _id, draft) =>
      sendHookTest(session, draft),
    ),

    http.get(route(apiRoutes.pluginInstances), () => HttpResponse.json(instanceSummaries())),

    // Tasks: the fixed paths before a run's own, which would read "running" as a run.
    http.get(route(apiRoutes.runningTasks), () => {
      const session = currentSession();
      return canReadRuns(session) ? HttpResponse.json(runningRuns(session)) : mayNotReadTasks();
    }),
    http.put(route(apiRoutes.taskRetention), async ({ request }) => {
      const retention = retentionSchema.safeParse(await request.json());
      if (!retention.success) {
        return invalidResponse(retention.error);
      }

      return outcomeResponse(saveRetention(currentSession(), retention.data));
    }),
    http.get(route(apiRoutes.tasks), ({ request }) => {
      const session = currentSession();
      if (!canReadRuns(session)) {
        return mayNotReadTasks();
      }

      const query = parseRunSearchParams(new URL(request.url).searchParams);
      return HttpResponse.json(queryRuns(session, query));
    }),
    http.get(route(`${apiRoutes.tasks}/:runId`), ({ params }) => {
      const session = currentSession();
      if (!canReadRuns(session)) {
        return mayNotReadTasks();
      }

      const detail = findRunDetail(session, String(params.runId));
      return detail === null ? noSuchRun() : HttpResponse.json(detail);
    }),
    http.get(route(`${apiRoutes.tasks}/:runId/log`), ({ params }) => {
      const session = currentSession();
      const text = canReadRuns(session) ? runLogText(session, String(params.runId)) : null;
      return text === null
        ? noSuchRun()
        : new HttpResponse(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }),
    ...(["cancel", "rerun"] as const).map((action) =>
      http.post(route(`${apiRoutes.tasks}/:runId/${action}`), ({ params }) => {
        const session = currentSession();
        if (!canReadRuns(session)) {
          return mayNotReadTasks();
        }

        const act = action === "cancel" ? cancelRun : runAgain;
        return outcomeResponse(act(session, String(params.runId)));
      }),
    ),

    http.get(route(apiRoutes.schedules), ({ request }) => {
      if (!canReadSchedules(currentSession())) {
        return mayNotReadSchedules();
      }

      const range = timelineRangeSchema
        .catch("day")
        .parse(new URL(request.url).searchParams.get("range"));
      return HttpResponse.json(querySchedules(range));
    }),
    http.post(route(apiRoutes.schedules), async ({ request }) => {
      const draft = newScheduleSchema.safeParse(await request.json());
      if (!draft.success) {
        return invalidResponse(draft.error);
      }

      return outcomeResponse(createSchedule(currentSession(), draft.data));
    }),
    http.put(route(`${apiRoutes.schedules}/:scheduleId`), async ({ params, request }) => {
      const draft = scheduleDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return invalidResponse(draft.error);
      }

      return outcomeResponse(saveSchedule(currentSession(), String(params.scheduleId), draft.data));
    }),
    http.delete(route(`${apiRoutes.schedules}/:scheduleId`), ({ params }) => {
      const outcome = deleteSchedule(currentSession(), String(params.scheduleId));
      return "refusal" in outcome
        ? problemResponse(outcome.refusal)
        : new HttpResponse(null, { status: 204 });
    }),
    recordAction(`${apiRoutes.schedules}/:id/pause`, pauseRequestSchema, pauseSchedule),
    http.post(route(`${apiRoutes.schedules}/:scheduleId/resume`), ({ params }) =>
      outcomeResponse(resumeSchedule(currentSession(), String(params.scheduleId))),
    ),
    http.post(route(`${apiRoutes.schedules}/:scheduleId/run`), ({ params }) =>
      outcomeResponse(runScheduleNow(currentSession(), String(params.scheduleId))),
    ),
    http.get(route(apiRoutes.plugins), () => {
      if (!canReadPlugins(currentSession())) {
        return problemResponse({ status: 403, message: "You may not read plugins" });
      }

      return HttpResponse.json(pluginIndex(currentSession()));
    }),
    accessWrite("post", apiRoutes.pluginInstances, newInstanceSchema, (session, _id, draft) =>
      createInstance(session, draft),
    ),
    accessWrite("put", `${apiRoutes.pluginInstances}/:id`, instanceDraftSchema, saveInstance),
    accessDelete(`${apiRoutes.pluginInstances}/:id`, deleteInstance),
    ...(["enable", "disable"] as const).map((action) =>
      http.post(route(`${apiRoutes.pluginInstances}/:id/${action}`), ({ params }) =>
        outcomeResponse(
          setInstanceEnabled(currentSession(), String(params.id), action === "enable"),
        ),
      ),
    ),
    http.get(route(`${apiRoutes.pluginInstances}/:id/impact`), ({ params }) =>
      outcomeResponse(instanceImpact(currentSession(), String(params.id))),
    ),
    http.post(route(`${apiRoutes.pluginInstances}/:id/run`), ({ params }) =>
      outcomeResponse(runInstanceNow(currentSession(), String(params.id))),
    ),
    http.get(route(`${apiRoutes.pluginInstances}/:id/upgrade`), ({ params }) =>
      outcomeResponse(instanceUpgrade(currentSession(), String(params.id))),
    ),
    http.post(route(`${apiRoutes.pluginInstances}/:id/upgrade`), ({ params }) =>
      outcomeResponse(upgradeInstance(currentSession(), String(params.id))),
    ),
    http.post(route(apiRoutes.pluginUploads), async ({ request }) => {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return problemResponse({ status: 422, message: "Choose a package to upload" });
      }

      const implementationId = form.get("implementationId");
      return outcomeResponse(
        readUpload(
          currentSession(),
          file.name,
          typeof implementationId === "string" ? implementationId : null,
        ),
      );
    }),
    http.post(route(`${apiRoutes.pluginUploads}/:id/install`), ({ params }) =>
      outcomeResponse(installUpload(currentSession(), String(params.id))),
    ),
    http.get(route(apiRoutes.access), () => {
      if (!canReadAccess(currentSession())) {
        return problemResponse({ status: 403, message: "You may not read users and groups" });
      }

      return HttpResponse.json(accessIndex());
    }),
    accessWrite("post", apiRoutes.accessRoles, roleDraftSchema, (session, _id, draft) =>
      createRole(session, draft),
    ),
    accessWrite("put", `${apiRoutes.accessRoles}/:id`, roleDraftSchema, saveAccessRole),
    http.get(route(`${apiRoutes.accessRoles}/:id/impact`), ({ params }) =>
      outcomeResponse(roleImpact(currentSession(), String(params.id))),
    ),
    accessDelete(`${apiRoutes.accessRoles}/:id`, deleteRole),
    accessWrite("post", apiRoutes.accessUsers, localAccountSchema, (session, _id, account) =>
      createLocalAccount(session, account),
    ),
    accessWrite("put", `${apiRoutes.accessUsers}/:id/roles`, handRolesSchema, setHandRoles),
    accessWrite(
      "put",
      `${apiRoutes.access}/identity-instances/:id/default-role`,
      identityDefaultRoleSchema,
      setIdentityDefaultRole,
    ),
    accessWrite("put", `${apiRoutes.accessUsers}/:id/groups`, userGroupsSchema, setUserGroups),
    http.delete(
      route(`${apiRoutes.accessUsers}/:id/identities/:instanceId/:externalId`),
      ({ params }) => {
        const outcome = unlinkIdentity(
          currentSession(),
          String(params.id),
          String(params.instanceId),
          String(params.externalId),
        );
        return "refusal" in outcome
          ? problemResponse(outcome.refusal)
          : new HttpResponse(null, { status: 204 });
      },
    ),
    http.post(route(`${apiRoutes.accessUsers}/:id/suspend`), ({ params }) =>
      outcomeResponse(suspendUser(currentSession(), String(params.id))),
    ),
    http.post(route(`${apiRoutes.accessUsers}/:id/restore`), ({ params }) =>
      outcomeResponse(restoreUser(currentSession(), String(params.id))),
    ),
    accessWrite(
      "post",
      `${apiRoutes.accessUsers}/:id/identities`,
      identityLinkSchema,
      linkIdentity,
    ),
    accessWrite("post", apiRoutes.accessGroups, recordDraftSchema, (session, _id, draft) =>
      createGroup(session, draft),
    ),
    accessWrite("put", `${apiRoutes.accessGroups}/:id`, recordDraftSchema, saveGroup),
    accessWrite(
      "put",
      `${apiRoutes.accessGroups}/:id/members`,
      groupMembersSchema,
      setGroupMembers,
    ),
    accessWrite("post", apiRoutes.accessCustodies, recordDraftSchema, (session, _id, draft) =>
      createCustody(session, draft),
    ),
    accessWrite("put", `${apiRoutes.accessCustodies}/:id`, recordDraftSchema, saveCustody),
    accessWrite(
      "put",
      `${apiRoutes.accessCustodies}/:id/members`,
      custodyMembersSchema,
      setCustodyMembers,
    ),
    http.get(route(`${apiRoutes.accessCustodies}/:id/impact`), ({ params }) =>
      outcomeResponse(custodyImpact(currentSession(), String(params.id))),
    ),
    accessDelete(`${apiRoutes.accessCustodies}/:id`, deleteCustody),
    http.get(route(apiRoutes.categories), () => HttpResponse.json(database.categories)),
    http.get(route(apiRoutes.categoryIndex), ({ request }) => {
      const session = currentSession();
      if (!canReadCategories(session)) {
        return problemResponse({ status: 403, message: "You may not read categories" });
      }

      const mixId = new URL(request.url).searchParams.get("mix") ?? undefined;
      return HttpResponse.json(queryCategoryIndex(session, mixId));
    }),
    http.post(route(apiRoutes.categories), async ({ request }) => {
      const draft = categoryDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return invalidResponse(draft.error);
      }

      return outcomeResponse(createCategory(currentSession(), draft.data));
    }),
    http.put(route(`${apiRoutes.categories}/:categoryId`), async ({ params, request }) => {
      const draft = categoryDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return invalidResponse(draft.error);
      }

      return outcomeResponse(saveCategory(currentSession(), String(params.categoryId), draft.data));
    }),
    http.delete(route(`${apiRoutes.categories}/:categoryId`), ({ params }) => {
      const outcome = deleteCategory(currentSession(), String(params.categoryId));
      if ("refusal" in outcome) {
        return problemResponse(outcome.refusal);
      }

      return new HttpResponse(null, { status: 204 });
    }),
    http.get(route(`${apiRoutes.categories}/:categoryId/impact`), ({ params }) =>
      outcomeResponse(categoryImpact(currentSession(), String(params.categoryId))),
    ),
    http.put(route(`${apiRoutes.categories}/:categoryId/custody`), async ({ params, request }) => {
      const draft = custodyDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return invalidResponse(draft.error);
      }

      return outcomeResponse(
        saveCategoryCustody(currentSession(), String(params.categoryId), draft.data),
      );
    }),
    recordAction(`${apiRoutes.categories}/:id/refine`, refineDraftSchema, refineCategory),
    http.get(route(apiRoutes.projects), () => HttpResponse.json(database.projects)),
    http.get(route(apiRoutes.groups), () => HttpResponse.json(listMemberGroups())),

    http.get(route(apiRoutes.intentionIndex), () => {
      const session = currentSession();
      if (!canReadIntentions(session)) {
        return problemResponse({ status: 403, message: "You may not read intentions" });
      }

      return HttpResponse.json(queryIntentionIndex(session));
    }),
    http.get(route(apiRoutes.mixes), () => outcomeResponse(listMixRecords(currentSession()))),
    http.get(route(`${apiRoutes.mixes}/:mixId`), ({ params }) =>
      outcomeResponse(getMixRecord(currentSession(), String(params.mixId))),
    ),
    http.post(route(apiRoutes.mixes), async ({ request }) => {
      const parsed = mixDraftSchema.safeParse(await request.json());
      return parsed.success
        ? outcomeResponse(createMixRecord(currentSession(), parsed.data))
        : invalidResponse(parsed.error);
    }),
    http.put(route(`${apiRoutes.mixes}/:mixId/sets`), async ({ params, request }) => {
      const parsed = mixSetChangeSchema.safeParse(await request.json());
      return parsed.success
        ? outcomeResponse(saveMixRecordSet(currentSession(), String(params.mixId), parsed.data))
        : invalidResponse(parsed.error);
    }),
    http.post(route(`${apiRoutes.mixes}/:mixId/snapshots`), async ({ params, request }) => {
      const parsed = mixSnapshotDraftSchema.safeParse(await request.json());
      return parsed.success
        ? outcomeResponse(snapshotMixRecord(currentSession(), String(params.mixId), parsed.data))
        : invalidResponse(parsed.error);
    }),
    http.post(route(`${apiRoutes.mixes}/:mixId/primary`), ({ params }) =>
      outcomeResponse(makeMixPrimary(currentSession(), String(params.mixId))),
    ),
    http.post(route(`${apiRoutes.mixes}/:mixId/archive`), ({ params }) =>
      outcomeResponse(archiveMixRecord(currentSession(), String(params.mixId))),
    ),
    http.delete(route(`${apiRoutes.mixes}/:mixId`), ({ params }) =>
      outcomeResponse(deleteMixRecord(currentSession(), String(params.mixId))),
    ),

    http.post(route(apiRoutes.intentionPreview), async ({ request }) => {
      const preview = intentionPreviewRequestSchema.safeParse(await request.json());
      if (!preview.success) {
        return invalidResponse(preview.error);
      }

      return outcomeResponse(previewIntention(currentSession(), preview.data));
    }),

    http.post(route(apiRoutes.intentions), async ({ request }) => {
      const draft = intentionDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return invalidResponse(draft.error);
      }

      const outcome = createIntention(currentSession(), draft.data);
      if ("refusal" in outcome) {
        return problemResponse(outcome.refusal);
      }

      return HttpResponse.json(outcome.value, { status: 201 });
    }),

    http.put(route(`${apiRoutes.intentions}/:intentionId`), async ({ params, request }) => {
      const draft = intentionDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return invalidResponse(draft.error);
      }

      return outcomeResponse(
        saveIntention(currentSession(), String(params.intentionId), draft.data),
      );
    }),

    http.post(route(`${apiRoutes.intentions}/:intentionId/archive`), ({ params }) =>
      outcomeResponse(archiveIntention(currentSession(), String(params.intentionId))),
    ),

    http.post(route(`${apiRoutes.intentions}/:intentionId/unarchive`), ({ params }) =>
      outcomeResponse(unarchiveIntention(currentSession(), String(params.intentionId))),
    ),

    http.get(route(`${apiRoutes.intentions}/:intentionId/correction`), ({ params, request }) => {
      const pages = Number(new URL(request.url).searchParams.get("pages"));
      if (!Number.isInteger(pages) || pages <= 0) {
        return problemResponse({ status: 422, message: "Say how many pages the list is for" });
      }

      return outcomeResponse(
        previewCorrection(currentSession(), String(params.intentionId), pages),
      );
    }),

    http.get(route(`${apiRoutes.intentions}/:intentionId/mix`), ({ params }) => {
      const session = currentSession();
      if (!canReadIntentions(session)) {
        return problemResponse({ status: 403, message: "You may not read intentions" });
      }

      const detail = findIntentionMix(session, String(params.intentionId));
      if (detail === null) {
        return problemResponse({ status: 404, message: "Intention not found" });
      }

      return HttpResponse.json(detail);
    }),

    http.get(route(`${apiRoutes.intentions}/:intentionId/deletion`), ({ params }) =>
      outcomeResponse(previewIntentionDeletion(currentSession(), String(params.intentionId))),
    ),

    http.delete(route(`${apiRoutes.intentions}/:intentionId`), ({ params }) => {
      const outcome = deleteIntention(currentSession(), String(params.intentionId));
      if ("refusal" in outcome) {
        return problemResponse(outcome.refusal);
      }

      return new HttpResponse(null, { status: 204 });
    }),

    http.post(route(apiRoutes.intentionTemplates), async ({ request }) => {
      const draft = intentionTemplateDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return invalidResponse(draft.error);
      }

      const outcome = createIntentionTemplate(currentSession(), draft.data);
      if ("refusal" in outcome) {
        return problemResponse(outcome.refusal);
      }

      return HttpResponse.json(outcome.value, { status: 201 });
    }),

    http.put(route(`${apiRoutes.intentionTemplates}/:templateId`), async ({ params, request }) => {
      const draft = intentionTemplateDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return invalidResponse(draft.error);
      }

      return outcomeResponse(
        saveIntentionTemplate(currentSession(), String(params.templateId), draft.data),
      );
    }),

    // Before `/:projectId`, so the index is not read as a project named "overview".
    http.get(route(apiRoutes.projectIndex), ({ request }) => {
      const session = currentSession();
      if (!canReadProjects(session)) {
        return mayNotReadProjects();
      }

      return HttpResponse.json(
        queryProjectIndex(session, parseProjectSearchParams(new URL(request.url).searchParams)),
      );
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

    http.post(route(`${apiRoutes.projects}/:projectId/preview`), async ({ params, request }) => {
      const draft = projectDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return invalidResponse(draft.error);
      }

      return outcomeResponse(
        previewProjectChange(currentSession(), String(params.projectId), draft.data),
      );
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
    http.get(route(apiRoutes.batches), () => HttpResponse.json(servedBatches())),

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

    http.get(route(apiRoutes.listShapes), () => outcomeResponse(listShapes(currentSession()))),

    http.post(route(apiRoutes.listReading), async ({ request }) => {
      const reading = listReadingRequestSchema.safeParse(await request.json());
      if (!reading.success) {
        return invalidResponse(reading.error);
      }

      return outcomeResponse(readList(currentSession(), reading.data));
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

    http.post(route(`${apiRoutes.digitizationLists}/:listId/start`), ({ params }) =>
      outcomeResponse(startListNow(currentSession(), String(params.listId))),
    ),

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
      const session = currentSession();
      const isMy = params.get("perspective") === "my";
      if (isMy && !canOpenMyDocuments(session)) return forbidden();
      const page = queryDocuments(
        session,
        parseDocumentSearchParams(params),
        parseDocumentSliceParams(params),
        parseDocumentGrouping(params),
        isMy ? "public" : undefined,
      );
      return HttpResponse.json(page);
    }),

    http.get(route(`${apiRoutes.documents}/:documentId`), ({ params, request }) => {
      const session = currentSession();
      const isMy = new URL(request.url).searchParams.get("perspective") === "my";
      if (isMy && !canOpenMyDocuments(session)) return forbidden();
      const detail = findDocumentDetail(
        session,
        String(params.documentId),
        isMy ? "public" : undefined,
      );
      if (detail === null) {
        return problemResponse({ status: 404, message: "Document not found" });
      }

      return HttpResponse.json(detail);
    }),

    iterationAction("reclassify", reclassificationSchema, reclassifyIteration),
    iterationAction("publish", publicationSchema, publishIteration),
    http.post(
      route(`${apiRoutes.iterations}/:id/links/:linkId/replace`),
      async ({ params, request }) => {
        const body = publicationSchema.safeParse(await request.json());
        if (!body.success) return invalidResponse(body.error);
        return outcomeResponse(
          replaceIterationLink(
            currentSession(),
            String(params.id),
            String(params.linkId),
            body.data,
          ),
        );
      },
    ),
    http.post(route(`${apiRoutes.iterations}/:id/links/:linkId/primary`), ({ params }) =>
      outcomeResponse(
        makeIterationLinkPrimary(currentSession(), String(params.id), String(params.linkId)),
      ),
    ),
    http.delete(route(`${apiRoutes.iterations}/:id/links/:linkId`), ({ params }) =>
      outcomeResponse(
        removeIterationLink(currentSession(), String(params.id), String(params.linkId)),
      ),
    ),
    iterationAction("page-count", pageCountSchema, enterPageCount),
    iterationAction("recheck", recheckSchema, recheckIteration),
    iterationAction("cancel", cancellationRequestSchema, cancelIteration),
    iterationAction("resume", resumeSchema, resumeIteration),
    iterationAction("overrule", overruleSchema, overruleRestriction),

    http.get(route(apiRoutes.proposalSettings), () =>
      HttpResponse.json(proposalSettingsOf(currentSession())),
    ),

    // ACT-ways-in: each is the proposer's, like the lookup.
    http.get(route(apiRoutes.proposalCatalogSearch), ({ request }) => {
      if (!hasPermission(currentSession(), "request.create")) {
        return problemResponse({ status: 403, message: "You may not propose" });
      }

      const params = new URL(request.url).searchParams;
      return HttpResponse.json(searchCatalogs(params.get("q") ?? "", params.get("catalog")));
    }),
    http.post(route(apiRoutes.proposalRecordLink), async ({ request }) => {
      if (!hasPermission(currentSession(), "request.create")) {
        return problemResponse({ status: 403, message: "You may not propose" });
      }

      const link = recordLinkSchema.safeParse(await request.json());
      return link.success
        ? outcomeResponse(readRecordLink(link.data))
        : invalidResponse(link.error);
    }),
    http.post(route(apiRoutes.proposalPhoto), async ({ request }) => {
      if (!hasPermission(currentSession(), "request.create")) {
        return problemResponse({ status: 403, message: "You may not propose" });
      }

      const photo = (await request.formData()).get("photo");
      return photo instanceof File
        ? outcomeResponse(readPhoto())
        : problemResponse({ status: 422, message: "Take a photo to read" });
    }),
    http.post(route(apiRoutes.proposalBarcode), async ({ request }) => {
      if (!hasPermission(currentSession(), "request.create")) {
        return problemResponse({ status: 403, message: "You may not propose" });
      }

      const photo = (await request.formData()).get("photo");
      return photo instanceof File
        ? outcomeResponse(readBarcode(photo))
        : problemResponse({ status: 422, message: "Photograph a barcode to read" });
    }),

    http.get(route(apiRoutes.proposalRateLimit), () => {
      const session = currentSession();
      return HttpResponse.json(getRateLimitStatus(session));
    }),

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

      const batchLimit = proposalLimitOf(session);
      if (batchLimit !== null && draft.data.items.length > batchLimit) {
        return problemResponse({
          status: 422,
          message: `At most ${batchLimit} items at once`,
        });
      }

      if (!canSubmitRateLimited(session, submittableProposalItemCount(session, draft.data))) {
        return problemResponse({
          status: 429,
          message: "Today's proposal limit has been reached",
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

    http.get(route(apiRoutes.requestCustodies), () => {
      if (!canReadRequests(currentSession())) {
        return mayNotReadRequests();
      }

      return HttpResponse.json(database.requestCustodies.map(publicCustodyOf));
    }),

    http.get(route(apiRoutes.requests), ({ request }) => {
      const session = currentSession();
      if (!canReadRequests(session)) {
        return mayNotReadRequests();
      }

      const params = new URL(request.url).searchParams;
      return HttpResponse.json(
        queryRequests(
          session,
          parseRequestSearchParams(params),
          parseRequestSliceParams(params),
          parseRequestGrouping(params),
        ),
      );
    }),

    http.post(
      route(`${apiRoutes.requests}/batches/:batchId/approve`),
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

    http.get(route(`${apiRoutes.requests}/:documentId`), ({ params }) => {
      const session = currentSession();
      if (!canReadRequests(session)) {
        return mayNotReadRequests();
      }

      const detail = findRequestDetail(session, String(params.documentId));
      if (detail === null) {
        return problemResponse({ status: 404, message: "Request not found" });
      }

      return HttpResponse.json(detail);
    }),

    http.post(route(`${apiRoutes.requests}/:documentId/approve`), async ({ params, request }) => {
      const session = currentSession();
      if (!canDecide(session)) {
        return mayNotDecide();
      }

      const approval = approvalSchema.safeParse(await request.json());
      if (!approval.success) {
        return invalidResponse(approval.error);
      }

      return outcomeResponse(approveProposal(session, String(params.documentId), approval.data));
    }),

    http.post(route(`${apiRoutes.requests}/:documentId/decline`), async ({ params, request }) => {
      const session = currentSession();
      if (!canDecide(session)) {
        return mayNotDecide();
      }

      const decline = declineSchema.safeParse(await request.json());
      if (!decline.success) {
        return invalidResponse(decline.error);
      }

      return outcomeResponse(declineProposal(session, String(params.documentId), decline.data));
    }),

    http.post(route(`${apiRoutes.requests}/:documentId/withdraw`), ({ params }) =>
      outcomeResponse(withdrawAsk(currentSession(), String(params.documentId))),
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

    http.post(route(apiRoutes.messageSend), async ({ request }) => {
      const params = new URL(request.url).searchParams;
      const subject = messageSubjectKindSchema.safeParse(params.get(messageSubjectParams.kind));
      const id = params.get(messageSubjectParams.id);
      const body = sendMessageBodySchema.safeParse(await request.json());
      if (!subject.success || id === null || id === "" || !body.success) {
        return problemResponse({ status: 422, message: "Say what to send and whom it is about" });
      }
      return outcomeResponse(
        sendMessage(
          currentSession(),
          { kind: subject.data, id },
          body.data.channelId,
          body.data.text,
        ),
      );
    }),

    http.get(route(apiRoutes.watchlists), ({ request }) => {
      const params = new URL(request.url).searchParams;
      const view = watchlistViewSchema.safeParse(params.get(watchlistViewParam));
      const mode = params.get(watchlistModeParam) === "manage-system" ? "manage-system" : "visible";
      if (mode === "manage-system" && !hasPermission(currentSession(), "watchlist.manage_system")) {
        return forbidden();
      }
      const rows = visibleWatchlists(currentSession(), view.success ? view.data : null, mode);
      flushWatchlistMail();
      flushWatchlistChat();
      return HttpResponse.json(rows);
    }),

    http.post(route(apiRoutes.watchlists), async ({ request }) => {
      const session = currentSession();
      const draft = watchlistDraftSchema.safeParse(await request.json());
      if (!draft.success) {
        return invalidResponse(draft.error);
      }
      if (!isValidWatchlistFilter(draft.data.view, draft.data.filter)) {
        return problemResponse({ status: 422, message: "Filter is not valid for this view" });
      }
      if (!canOpenView(session, draft.data.view)) return forbidden();

      // ACT-watchlist-save: a personal one needs `watch`, any other `watchlist.manage_system`.
      if (draft.data.audience.kind === "personal" && !hasPermission(session, "watch")) {
        return forbidden();
      }
      if (!canChange(session, draft.data.audience)) {
        return forbidden();
      }

      const source = draft.data.copyOf ? findVisibleWatchlist(session, draft.data.copyOf) : null;
      if (draft.data.copyOf !== undefined) {
        if (
          draft.data.audience.kind !== "personal" ||
          source === null ||
          source.audience.kind === "personal" ||
          source.view !== draft.data.view ||
          !isSameWatchlistFilter(source.view, source.filter, draft.data.filter)
        ) {
          return problemResponse({
            status: 422,
            message: "Choose a visible system watchlist to copy",
          });
        }
      }

      const duplicate = findDuplicateWatchlist(
        session,
        { ...draft.data, id: null },
        source !== null,
      );
      if (
        duplicate !== null &&
        !(
          draft.data.audience.kind !== "personal" &&
          duplicate.audience.kind === "personal" &&
          duplicate.ownerId === session.user.id
        )
      ) {
        return alreadySaved(duplicate);
      }

      const { copyOf: _copyOf, ...watchlistData } = draft.data;
      const watchlist = {
        ...watchlistData,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      database.watchlists.push({
        ...watchlist,
        ownerId: session.user.id,
        copiedFrom: source?.id,
      });
      return HttpResponse.json(watchlist, { status: 201 });
    }),

    http.post(route(apiRoutes.watchlistReach), async ({ request }) => {
      if (!hasPermission(currentSession(), "watchlist.manage_system")) {
        return forbidden();
      }

      const reach = watchlistReachRequestSchema.safeParse(await request.json());
      if (!reach.success) {
        return invalidResponse(reach.error);
      }
      if (!isValidWatchlistFilter(reach.data.view, reach.data.filter)) {
        return problemResponse({ status: 422, message: "Filter is not valid for this view" });
      }
      if (!canOpenView(currentSession(), reach.data.view)) return forbidden();

      return HttpResponse.json(watchlistReachOf(reach.data));
    }),

    http.get(route(apiRoutes.roles), () =>
      HttpResponse.json(database.roles.map(({ id, name }) => ({ id, name }))),
    ),

    http.patch(route(`${apiRoutes.watchlists}/:watchlistId`), async ({ params, request }) => {
      const session = currentSession();
      const watchlist =
        findChangeableWatchlist(session, String(params.watchlistId)) ??
        findVisibleWatchlist(session, String(params.watchlistId));
      if (watchlist === null) {
        return problemResponse({ status: 404, message: "Watchlist not found" });
      }

      if (!canChange(session, watchlist.audience)) {
        return forbidden();
      }

      const change = watchlistChangeSchema.safeParse(await request.json());
      if (!change.success) {
        return invalidResponse(change.error);
      }
      if (
        change.data.filter !== undefined &&
        !isValidWatchlistFilter(watchlist.view, change.data.filter)
      ) {
        return problemResponse({ status: 422, message: "Filter is not valid for this view" });
      }

      const audience = change.data.audience ?? watchlist.audience;
      if (!canChange(session, audience)) {
        return forbidden();
      }

      if (audience.kind === "personal" && watchlist.audience.kind !== "personal") {
        return problemResponse({
          status: 409,
          message: "System watchlists cannot become personal",
        });
      }
      if (audience.kind !== "personal" && watchlist.audience.kind === "personal") {
        return problemResponse({ status: 409, message: "Create a separate system copy instead" });
      }
      const changed = {
        ...watchlist,
        ...change.data,
        filterVersion:
          change.data.filter === undefined ||
          isSameWatchlistFilter(watchlist.view, watchlist.filter, change.data.filter)
            ? (watchlist.filterVersion ?? 1)
            : (watchlist.filterVersion ?? 1) + 1,
      };
      const source = watchlist.copiedFrom
        ? database.watchlists.find((item) => item.id === watchlist.copiedFrom)
        : undefined;
      const keepsSourceFilter =
        source !== undefined && isSameWatchlistFilter(changed.view, changed.filter, source.filter);
      const duplicate = findDuplicateWatchlist(session, changed, keepsSourceFilter);
      if (duplicate !== null) {
        return alreadySaved(duplicate);
      }

      database.watchlists.splice(database.watchlists.indexOf(watchlist), 1, changed);
      if (watchlist.audience.kind !== "personal") {
        const oldReach = audienceReachOf(watchlist.audience, watchlist.view).reachedIds;
        const newReach = new Set(audienceReachOf(changed.audience, changed.view).reachedIds);
        noteSystemWatchlistChange(
          watchlist.id,
          "audience_removed",
          oldReach.filter((id) => !newReach.has(id)),
        );
        if (changed.filterVersion !== (watchlist.filterVersion ?? 1)) {
          noteSystemWatchlistChange(
            watchlist.id,
            "filter_changed",
            oldReach.filter((id) => newReach.has(id)),
          );
        }
      }
      return HttpResponse.json(publicWatchlistOf(changed));
    }),

    http.patch(
      route(`${apiRoutes.watchlists}/:watchlistId/viewer`),
      async ({ params, request }) => {
        const session = currentSession();
        const watchlist = findVisibleWatchlist(session, String(params.watchlistId));
        if (watchlist === null) {
          return problemResponse({ status: 404, message: "Watchlist not found" });
        }
        const change = watchlistViewerChangeSchema.safeParse(await request.json());
        if (!change.success) {
          return invalidResponse(change.error);
        }
        const viewer = database.watchlistViewers.find(
          (row) => row.userId === session.user.id && row.watchlistId === watchlist.id,
        );
        const current = viewer ?? viewerOf(session.user.id, watchlist);
        const now = new Date().toISOString();
        // A channel switched on starts from now: what matched before is a baseline.
        const channels = Object.fromEntries(
          Object.entries(change.data.channels ?? {}).map(([channelId, isOn]) => [
            channelId,
            {
              isOn,
              since:
                isOn && current.channels[channelId]?.isOn !== true
                  ? now
                  : (current.channels[channelId]?.since ?? null),
            },
          ]),
        );
        const changed = {
          ...current,
          ...change.data,
          channels: { ...current.channels, ...channels },
        };
        if (change.data.push === true && !current.push) changed.pushSince = now;
        const row = database.watchlistViewers.find(
          (candidate) =>
            candidate.userId === session.user.id && candidate.watchlistId === watchlist.id,
        );
        if (row !== undefined) Object.assign(row, changed);
        storeWatchlistViewers(database.watchlistViewers);
        return HttpResponse.json(changed);
      },
    ),

    http.post(route(`${apiRoutes.watchlists}/:watchlistId/seen`), ({ params }) => {
      const session = currentSession();
      const watchlist = findVisibleWatchlist(session, String(params.watchlistId));
      if (watchlist === null) {
        return problemResponse({ status: 404, message: "Watchlist not found" });
      }
      // Materialize the current entries before advancing this person's seen cursor.
      visibleWatchlists(session, watchlist.view);
      const viewer = database.watchlistViewers.find(
        (row) => row.userId === session.user.id && row.watchlistId === watchlist.id,
      );
      if (viewer === undefined)
        return problemResponse({ status: 404, message: "Viewer not found" });
      viewer.seenAt = new Date().toISOString();
      storeWatchlistViewers(database.watchlistViewers);
      return HttpResponse.json(viewerOf(session.user.id, watchlist));
    }),

    http.delete(route(`${apiRoutes.watchlists}/:watchlistId`), ({ params }) => {
      const session = currentSession();
      const watchlist =
        findChangeableWatchlist(session, String(params.watchlistId)) ??
        findVisibleWatchlist(session, String(params.watchlistId));
      if (watchlist === null) {
        return problemResponse({ status: 404, message: "Watchlist not found" });
      }

      if (!canChange(session, watchlist.audience)) {
        return forbidden();
      }

      if (watchlist.audience.kind !== "personal") {
        noteSystemWatchlistChange(
          watchlist.id,
          "removed",
          audienceReachOf(watchlist.audience, watchlist.view).reachedIds,
        );
      }
      database.watchlists.splice(database.watchlists.indexOf(watchlist), 1);
      database.watchlistViewers = database.watchlistViewers.filter(
        (viewer) => viewer.watchlistId !== watchlist.id,
      );
      storeWatchlistViewers(database.watchlistViewers);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}

function mayNotReadRequests() {
  return problemResponse({ status: 403, message: "You may not read requests" });
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

function mayNotReadTasks() {
  return problemResponse({ status: 403, message: "You may not read tasks" });
}

function mayNotReadSchedules() {
  return problemResponse({ status: 403, message: "You may not read schedules" });
}

function noSuchRun() {
  return problemResponse({ status: 404, message: "No such run" });
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
