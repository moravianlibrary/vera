// The contract check at the HTTP boundary: every request is parsed against its endpoint's
// schemas before the handler sees it, and every answer is proven against the endpoint's response
// schema before it leaves (docs/develop/engine.md, Contract). Input that does not fit is refused
// (400 unreadable, 422 not accepted); an answer that does not fit is the engine's own fault and
// goes out as a 500, with the issues, so a test fails on it.

import { z } from "zod";
import type { Engine } from "../engine";
import type { Caller, Endpoint } from "./endpoint";
import { matchPath } from "./match";
import { fieldErrorsOf, problem } from "./problem";

export const apiPrefix = "/api";

export type CallerResolver = (request: Request) => Caller | null;

export async function serveApi(
  request: Request,
  endpoints: readonly Endpoint[],
  engine: Engine,
  callerOf: CallerResolver,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice(apiPrefix.length) || "/";
  const matching = endpoints.flatMap((candidate) => {
    const params = matchPath(candidate.path, path);
    return params === null ? [] : [{ endpoint: candidate, params }];
  });
  if (matching.length === 0) {
    return problem(404, `No endpoint answers ${path}.`);
  }

  const found = matching.find(({ endpoint }) => endpoint.method === request.method);
  if (found === undefined) {
    return problem(405, `${path} does not answer ${request.method}.`);
  }

  const { endpoint, params: rawParams } = found;
  const params = parseInput(endpoint.params, rawParams);
  if (params instanceof Response) {
    return params;
  }

  const query = parseInput(endpoint.query, Object.fromEntries(url.searchParams));
  if (query instanceof Response) {
    return query;
  }

  let rawBody: unknown;
  if (endpoint.body !== undefined) {
    try {
      rawBody = await request.json();
    } catch {
      return problem(400, "The body is not JSON.");
    }
  }

  const body = parseInput(endpoint.body, rawBody);
  if (body instanceof Response) {
    return body;
  }

  try {
    const answer = await endpoint.handle({
      params,
      query,
      body,
      caller: callerOf(request),
      engine,
      request,
    });
    if (answer instanceof Response) {
      return answer;
    }

    return checkedAnswer(endpoint, request.method, path, answer.status ?? 200, answer.body);
  } catch (error) {
    console.error(`${request.method} ${path} failed`, error);
    return problem(500, error instanceof Error ? error.message : String(error));
  }
}

function parseInput(schema: z.ZodType | undefined, value: unknown): unknown {
  if (schema === undefined) {
    return undefined;
  }

  const parsed = schema.safeParse(value);
  return parsed.success
    ? parsed.data
    : problem(422, parsed.error.issues[0]?.message ?? "Not accepted", {
        errors: fieldErrorsOf(parsed.error.issues),
      });
}

function checkedAnswer(
  endpoint: Endpoint,
  method: string,
  path: string,
  status: number,
  body: unknown,
): Response {
  if (endpoint.response === undefined) {
    return new Response(null, { status: 204 });
  }

  const checked = endpoint.response.safeParse(body);
  if (!checked.success) {
    const issues = z.prettifyError(checked.error);
    console.error(`${method} ${path} answered outside the contract:\n${issues}`);
    return problem(500, `The answer does not fit the contract:\n${issues}`, {
      code: "contract.response",
    });
  }

  // The answer as sent is what the client parses: the unparsed value, so that a schema's
  // defaults and transforms are not applied twice.
  return Response.json(body, { status });
}
