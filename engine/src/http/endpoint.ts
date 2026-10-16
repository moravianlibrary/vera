// An endpoint of VERA's API as the engine serves it: its method, its path under /api (a contract
// route, with `:name` for a path segment), the contract schemas its input and its answer must
// fit, and its handler. The handler answers a value, which the contract check proves against
// `response`, or a Response, which is a refusal and goes out as it is.

import type { z } from "zod";
import type { Engine } from "../engine";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface Caller {
  userId: string;
}

export interface Context<Params, Query, Body> {
  params: Params;
  query: Query;
  body: Body;
  // Null when nobody is signed in.
  caller: Caller | null;
  engine: Engine;
  request: Request;
}

export interface Answer<Value> {
  status?: number;
  body: Value;
}

export interface Endpoint<Params = unknown, Query = unknown, Body = unknown, Value = unknown> {
  method: Method;
  path: string;
  params?: z.ZodType<Params>;
  query?: z.ZodType<Query>;
  body?: z.ZodType<Body>;
  // Absent for an endpoint that answers 204 with no body.
  response?: z.ZodType<Value>;
  handle(
    context: Context<Params, Query, Body>,
  ): Answer<Value> | Response | Promise<Answer<Value> | Response>;
}

// Only for the types: the handler's context and answer are inferred from the schemas.
export function endpoint<
  Params = undefined,
  Query = undefined,
  Body = undefined,
  Value = undefined,
>(definition: Endpoint<Params, Query, Body, Value>): Endpoint {
  return definition as unknown as Endpoint;
}
