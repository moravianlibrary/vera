// Every endpoint of VERA's API, as a table (docs/develop/engine.md, E1): its method, its path
// under the API's base (a route, with `:name` for a path segment), the schemas its input and its
// answer fit, and the problem codes it may refuse with besides its status's own. The engine
// serves exactly this table, and the OpenAPI document for the Java backend is to be made from it.
// It grows with the engine, a step at a time.

import {
  accessGroupSchema,
  accessUserSchema,
  custodyRecordSchema,
  identitySchema,
  roleSchema,
} from "@vera/domain/access";
import { sessionSchema } from "@vera/domain/entities";
import { z } from "zod";
import {
  accessIndexSchema,
  custodyImpactSchema,
  custodyMembersSchema,
  groupMembersSchema,
  handRolesSchema,
  identityLinkSchema,
  localAccountSchema,
  recordDraftSchema,
  roleDraftSchema,
  roleImpactSchema,
  userGroupsSchema,
} from "./access";
import { localLoginSchema, loginEntrySchema } from "./login";
import { apiRoutes } from "./routes";
import { userSettingsChangeSchema, userSettingsSchema } from "./user-settings";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface EndpointSpec<Params = unknown, Query = unknown, Body = unknown, Value = unknown> {
  method: Method;
  path: string;
  summary: string;
  params?: z.ZodType<Params>;
  query?: z.ZodType<Query>;
  body?: z.ZodType<Body>;
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
};

export type EndpointName = keyof typeof endpoints;
