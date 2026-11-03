// Every endpoint of VERA's API, as a table (docs/develop/engine.md, E1): its method, its path
// under the API's base (a route, with `:name` for a path segment), the schemas its input and its
// answer fit, and the problem codes it may refuse with besides its status's own. The engine
// serves exactly this table, and the OpenAPI document for the Java backend is to be made from it.
// It grows with the engine, a step at a time.

import {
  accessGroupSchema,
  accessUserSchema,
  custodyRecordSchema,
  identityInstanceSchema,
  identitySchema,
  roleSchema,
} from "@vera/domain/access";
import { batchSchema, requestCustodySchema, sessionSchema } from "@vera/domain/entities";
import { z } from "zod";
import {
  accessIndexSchema,
  custodyImpactSchema,
  custodyMembersSchema,
  groupMembersSchema,
  handRolesSchema,
  identityDefaultRoleSchema,
  identityLinkSchema,
  localAccountSchema,
  recordDraftSchema,
  roleDraftSchema,
  roleImpactSchema,
  userGroupsSchema,
} from "./access";
import {
  documentDetailSchema,
  documentGroupingParam,
  documentPageSchema,
  documentQueryParams,
  documentSliceParams,
} from "./documents";
import {
  emailOnlySchema,
  localLoginSchema,
  loginEntrySchema,
  passwordResetSchema,
  signUpSchema,
  tokenSchema,
  verifiedSchema,
} from "./login";
import {
  barcodeReadingSchema,
  catalogHitSchema,
  photoReadingSchema,
  proposalCheckSchema,
  proposalDraftSchema,
  proposalLookupSchema,
  proposalReportSchema,
  proposalSettingsSchema,
  rateLimitStatusSchema,
  recordLinkReadingSchema,
  recordLinkSchema,
} from "./proposals";
import {
  requestDetailSchema,
  requestGroupingParam,
  requestPageSchema,
  requestQueryParams,
  requestSliceParams,
} from "./requests";
import { accessRecordActionRoute, apiRoutes } from "./routes";
import { userSettingsChangeSchema, userSettingsSchema } from "./user-settings";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface EndpointSpec<Params = unknown, Query = unknown, Body = unknown, Value = unknown> {
  method: Method;
  path: string;
  summary: string;
  params?: z.ZodType<Params>;
  query?: z.ZodType<Query>;
  body?: z.ZodType<Body>;
  form?: readonly string[];
  // Absent for an endpoint that answers 204 with no body.
  response?: z.ZodType<Value>;
  redirects?: boolean;
  public?: boolean;
  // The codes of the refusals it may answer (ACT-refusal), besides each status's own.
  codes: readonly string[];
}

// Only for the types: an entry keeps its schemas' types, for the engine's handler.
function spec<Params = undefined, Query = undefined, Body = undefined, Value = undefined>(
  entry: EndpointSpec<Params, Query, Body, Value>,
): EndpointSpec<Params, Query, Body, Value> {
  return entry;
}

export const endpoints = {
  documents: spec({
    method: "GET",
    path: apiRoutes.documents,
    summary: "Search documents.",
    query: z.object(
      Object.fromEntries(
        [
          ...Object.values(documentQueryParams),
          ...Object.values(documentSliceParams),
          documentGroupingParam,
          "perspective",
        ].map((key) => [key, z.string().optional()]),
      ),
    ),
    response: documentPageSchema,
    codes: [],
  }),
  documentDetail: spec({
    method: "GET",
    path: `${apiRoutes.documents}/:documentId`,
    summary: "Read a document.",
    params: z.object({ documentId: z.string() }),
    query: z.object({ perspective: z.string().optional() }),
    response: documentDetailSchema,
    codes: [],
  }),
  requests: spec({
    method: "GET",
    path: apiRoutes.requests,
    summary: "Search requests.",
    query: z.object(
      Object.fromEntries(
        [
          ...Object.values(requestQueryParams),
          ...Object.values(requestSliceParams),
          requestGroupingParam,
        ].map((key) => [key, z.string().optional()]),
      ),
    ),
    response: requestPageSchema,
    codes: [],
  }),
  requestDetail: spec({
    method: "GET",
    path: `${apiRoutes.requests}/:documentId`,
    summary: "Read a request.",
    params: z.object({ documentId: z.string() }),
    response: requestDetailSchema,
    codes: [],
  }),
  requestCustodies: spec({
    method: "GET",
    path: apiRoutes.requestCustodies,
    summary: "Read request custodies.",
    response: z.array(requestCustodySchema),
    codes: [],
  }),
  batches: spec({
    method: "GET",
    path: apiRoutes.batches,
    summary: "Read batches.",
    response: z.array(batchSchema),
    codes: [],
  }),
  loginEntries: spec({
    method: "GET",
    path: apiRoutes.login,
    summary: "Enabled ways to log in.",
    response: z.array(loginEntrySchema),
    codes: [],
    public: true,
  }),
  loginForm: spec({
    method: "POST",
    path: `${apiRoutes.login}/:instanceId`,
    summary: "Logs in with a local account.",
    params: z.object({ instanceId: z.string() }),
    body: localLoginSchema,
    codes: ["access.suspended"],
    public: true,
  }),
  loginStart: spec({
    method: "GET",
    path: `${apiRoutes.login}/:instanceId`,
    summary: "Starts a provider login.",
    params: z.object({ instanceId: z.string() }),
    query: z.object({ returnTo: z.string().optional() }),
    codes: [],
    redirects: true,
    public: true,
  }),
  loginCallback: spec({
    method: "GET",
    path: `${apiRoutes.login}/:instanceId/callback`,
    summary: "Completes a provider login.",
    params: z.object({ instanceId: z.string() }),
    query: z.object({ flow: z.string(), code: z.string() }),
    codes: ["access.suspended", "login.expired"],
    redirects: true,
    public: true,
  }),
  signUp: spec({
    method: "POST",
    path: `${apiRoutes.signUp}/:instanceId`,
    summary: "Starts a local account sign-up.",
    params: z.object({ instanceId: z.string() }),
    body: signUpSchema,
    codes: ["access.password_short", "access.username_taken"],
    public: true,
  }),
  confirmEmail: spec({
    method: "POST",
    path: `${apiRoutes.emailVerification}/confirm`,
    summary: "Verifies an email and creates a local account.",
    body: tokenSchema,
    response: verifiedSchema,
    codes: ["access.link_expired"],
    public: true,
  }),
  sendVerificationAgain: spec({
    method: "POST",
    path: `${apiRoutes.emailVerification}/:instanceId`,
    summary: "Sends another email verification link.",
    params: z.object({ instanceId: z.string() }),
    body: emailOnlySchema,
    codes: [],
    public: true,
  }),
  resetPassword: spec({
    method: "POST",
    path: `${apiRoutes.passwordReset}/confirm`,
    summary: "Sets a new local account password.",
    body: passwordResetSchema,
    codes: ["access.link_expired", "access.password_short"],
    public: true,
  }),
  requestPasswordReset: spec({
    method: "POST",
    path: `${apiRoutes.passwordReset}/:instanceId`,
    summary: "Sends a local account password reset link.",
    params: z.object({ instanceId: z.string() }),
    body: emailOnlySchema,
    codes: [],
    public: true,
  }),
  session: spec({
    method: "GET",
    path: apiRoutes.session,
    summary: "The signed-in person: their roles, grants, groups and category custody.",
    response: sessionSchema,
    codes: [],
  }),
  logout: spec({
    method: "DELETE",
    path: apiRoutes.sessionLogout,
    summary: "Ends the caller's session; the cookie is cleared.",
    codes: [],
  }),
  accessIndex: spec({
    method: "GET",
    path: apiRoutes.access,
    summary: "Users, groups, roles and request custody.",
    response: accessIndexSchema,
    codes: [],
  }),
  roleCreate: spec({
    method: "POST",
    path: apiRoutes.accessRoles,
    summary: "Creates a role.",
    body: roleDraftSchema,
    response: roleSchema,
    codes: ["access.name_taken", "role.requires"],
  }),
  roleSave: spec({
    method: "PUT",
    path: `${apiRoutes.access}/roles/:id`,
    summary: "Saves a role.",
    params: z.object({ id: z.string() }),
    body: roleDraftSchema,
    response: roleSchema,
    codes: ["access.name_taken", "access.last_manager", "role.requires"],
  }),
  roleDelete: spec({
    method: "DELETE",
    path: `${apiRoutes.access}/roles/:id`,
    summary: "Deletes a role.",
    params: z.object({ id: z.string() }),
    codes: ["access.last_manager"],
  }),
  roleImpact: spec({
    method: "GET",
    path: `${apiRoutes.access}/roles/:id/impact`,
    summary: "Counts the impact of deleting a role.",
    params: z.object({ id: z.string() }),
    response: roleImpactSchema,
    codes: [],
  }),
  localAccount: spec({
    method: "POST",
    path: apiRoutes.accessUsers,
    summary: "Creates a local account.",
    body: localAccountSchema,
    response: accessUserSchema,
    codes: ["access.name_taken"],
  }),
  userRoles: spec({
    method: "PUT",
    path: `${apiRoutes.access}/users/:id/roles`,
    summary: "Sets a person's hand roles.",
    params: z.object({ id: z.string() }),
    body: handRolesSchema,
    response: accessUserSchema,
    codes: ["access.last_manager"],
  }),
  userGroups: spec({
    method: "PUT",
    path: `${apiRoutes.access}/users/:id/groups`,
    summary: "Sets a person's groups.",
    params: z.object({ id: z.string() }),
    body: userGroupsSchema,
    response: accessUserSchema,
    codes: [],
  }),
  identityLink: spec({
    method: "POST",
    path: `${apiRoutes.access}/users/:id/identities`,
    summary: "Links an identity.",
    params: z.object({ id: z.string() }),
    body: identityLinkSchema,
    response: identitySchema,
    codes: ["access.identity_taken"],
  }),
  identityDefaultRole: spec({
    method: "PUT",
    path: accessRecordActionRoute("identity-instances", ":id", "default-role"),
    summary: "Sets an Identity instance's default role.",
    params: z.object({ id: z.string() }),
    body: identityDefaultRoleSchema,
    response: identityInstanceSchema,
    codes: [],
  }),
  identityUnlink: spec({
    method: "DELETE",
    path: `${apiRoutes.access}/users/:id/identities/:instanceId/:externalId`,
    summary: "Unlinks an identity.",
    params: z.object({ id: z.string(), instanceId: z.string(), externalId: z.string() }),
    codes: ["access.last_identity"],
  }),
  userSuspend: spec({
    method: "POST",
    path: `${apiRoutes.access}/users/:id/suspend`,
    summary: "Suspends a person.",
    params: z.object({ id: z.string() }),
    body: z.object({}),
    response: accessUserSchema,
    codes: ["access.last_manager"],
  }),
  userRestore: spec({
    method: "POST",
    path: `${apiRoutes.access}/users/:id/restore`,
    summary: "Restores a person.",
    params: z.object({ id: z.string() }),
    body: z.object({}),
    response: accessUserSchema,
    codes: ["access.not_suspended"],
  }),
  groupCreate: spec({
    method: "POST",
    path: apiRoutes.accessGroups,
    summary: "Creates a group.",
    body: recordDraftSchema,
    response: accessGroupSchema,
    codes: ["access.name_taken"],
  }),
  groupSave: spec({
    method: "PUT",
    path: `${apiRoutes.access}/groups/:id`,
    summary: "Saves a group.",
    params: z.object({ id: z.string() }),
    body: recordDraftSchema,
    response: accessGroupSchema,
    codes: ["access.name_taken"],
  }),
  groupMembers: spec({
    method: "PUT",
    path: `${apiRoutes.access}/groups/:id/members`,
    summary: "Sets group members.",
    params: z.object({ id: z.string() }),
    body: groupMembersSchema,
    response: accessGroupSchema,
    codes: [],
  }),
  custodyCreate: spec({
    method: "POST",
    path: apiRoutes.accessCustodies,
    summary: "Creates a custody.",
    body: recordDraftSchema,
    response: custodyRecordSchema,
    codes: ["access.name_taken"],
  }),
  custodySave: spec({
    method: "PUT",
    path: `${apiRoutes.access}/custodies/:id`,
    summary: "Saves a custody.",
    params: z.object({ id: z.string() }),
    body: recordDraftSchema,
    response: custodyRecordSchema,
    codes: ["access.name_taken", "access.fallback"],
  }),
  custodyMembers: spec({
    method: "PUT",
    path: `${apiRoutes.access}/custodies/:id/members`,
    summary: "Sets custody members.",
    params: z.object({ id: z.string() }),
    body: custodyMembersSchema,
    response: custodyRecordSchema,
    codes: [],
  }),
  custodyDelete: spec({
    method: "DELETE",
    path: `${apiRoutes.access}/custodies/:id`,
    summary: "Deletes a custody.",
    params: z.object({ id: z.string() }),
    codes: ["access.fallback"],
  }),
  custodyImpact: spec({
    method: "GET",
    path: `${apiRoutes.access}/custodies/:id/impact`,
    summary: "Counts the impact of deleting a custody.",
    params: z.object({ id: z.string() }),
    response: custodyImpactSchema,
    codes: [],
  }),
  account: spec({
    method: "GET",
    path: apiRoutes.sessionAccount,
    summary: "The signed-in person's account.",
    response: accessUserSchema,
    codes: [],
  }),
  settingsGet: spec({
    method: "GET",
    path: apiRoutes.userSettings,
    summary: "The signed-in person's settings.",
    response: userSettingsSchema,
    codes: [],
  }),
  settingsPatch: spec({
    method: "PATCH",
    path: apiRoutes.userSettings,
    summary: "Changes the signed-in person's settings.",
    body: userSettingsChangeSchema,
    response: userSettingsSchema,
    codes: [],
  }),
  proposalSettings: spec({
    method: "GET",
    path: apiRoutes.proposalSettings,
    summary: "Read proposal settings.",
    response: proposalSettingsSchema,
    codes: [],
  }),
  proposalRateLimit: spec({
    method: "GET",
    path: apiRoutes.proposalRateLimit,
    summary: "Read the remaining proposal limit.",
    response: rateLimitStatusSchema,
    codes: [],
  }),
  proposalLookup: spec({
    method: "POST",
    path: apiRoutes.proposalLookup,
    summary: "Check proposed items.",
    body: proposalLookupSchema,
    response: z.array(proposalCheckSchema),
    codes: ["forbidden"],
  }),
  proposalCatalogSearch: spec({
    method: "GET",
    path: apiRoutes.proposalCatalogSearch,
    summary: "Search proposal catalogs.",
    query: z.object({ q: z.string().optional(), catalog: z.string().optional() }),
    response: z.array(catalogHitSchema),
    codes: ["forbidden"],
  }),
  proposalRecordLink: spec({
    method: "POST",
    path: apiRoutes.proposalRecordLink,
    summary: "Read a catalog record link.",
    body: recordLinkSchema,
    response: recordLinkReadingSchema,
    codes: ["forbidden", "proposal.link_unread"],
  }),
  proposalPhoto: spec({
    method: "POST",
    path: apiRoutes.proposalPhoto,
    summary: "Read a catalog photo.",
    form: ["photo"],
    response: photoReadingSchema,
    codes: ["forbidden", "proposal.no_photo_reader", "proposal.photo_missing"],
  }),
  proposalBarcode: spec({
    method: "POST",
    path: apiRoutes.proposalBarcode,
    summary: "Read a barcode photo.",
    form: ["photo"],
    response: barcodeReadingSchema,
    codes: ["forbidden", "proposal.no_barcode_reader", "proposal.photo_missing"],
  }),
  proposals: spec({
    method: "POST",
    path: apiRoutes.proposals,
    summary: "Submit a proposal.",
    body: proposalDraftSchema,
    response: proposalReportSchema,
    codes: [
      "forbidden",
      "proposal.too_many_items",
      "proposal.daily_limit",
      "project.not_proposable",
    ],
  }),
};

export type EndpointName = keyof typeof endpoints;
