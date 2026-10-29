// Every endpoint of VERA's API, as a table (docs/develop/engine.md, E1): its method, its path
// under the API's base (a route, with `:name` for a path segment), the schemas its input and its
// answer fit, and the problem codes it may refuse with besides its status's own. The engine
// serves exactly this table, and the OpenAPI document for the Java backend is to be made from it.
// It grows with the engine, a step at a time.

import { sessionSchema } from "@vera/domain/entities";
import type { z } from "zod";
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
  session: spec({
    method: "GET",
    path: apiRoutes.session,
    summary: "The signed-in person: their roles, grants, groups and category custody.",
    response: sessionSchema,
    codes: [],
  }),
};

export type EndpointName = keyof typeof endpoints;
