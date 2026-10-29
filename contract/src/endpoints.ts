// Every endpoint of VERA's API, as a table (docs/develop/engine.md, E1): its method, its path
// under the API's base (a route, with `:name` for a path segment), the schemas its input and its
// answer fit, and the problem codes it may refuse with besides its status's own. The engine
// serves exactly this table, and the OpenAPI document for the Java backend is to be made from it.
// It grows with the engine, a step at a time.

import { sessionSchema } from "@vera/domain/entities";
import { z } from "zod";
import { localLoginSchema, loginEntrySchema } from "./login";
import { apiRoutes } from "./routes";

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
};

export type EndpointName = keyof typeof endpoints;
