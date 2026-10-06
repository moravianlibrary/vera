// The HTTP boundary. Every response is parsed against its schema here, once, so callers receive
// typed and trusted values. A failed request or an unexpected body raises ApiError; an expected
// absence (404 on a lookup) is returned as null by `findJson`. A refusal's body is RFC 9457
// Problem Details (decided 2026-10-06), kept on the ApiError for the caller to word.

import { z } from "zod";
import { env } from "@/config/env";

// RFC 9457 Problem Details, with VERA's two extensions: `code`, a stable key a refusal is worded
// by (and translated by, later), and `errors`, the fields a 422 rejected.
export const problemSchema = z.object({
  type: z.string().default("about:blank"),
  title: z.string().optional(),
  status: z.number().int().optional(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string().optional(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
});
export type Problem = z.infer<typeof problemSchema>;

export class ApiError extends Error {
  readonly status: number;
  readonly path: string;
  // Null when the server sent no Problem Details: a proxy's page, or nothing at all.
  readonly problem: Problem | null;

  constructor(status: number, path: string, message: string, problem: Problem | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
    this.problem = problem;
  }
}

const notFoundStatus = 404;

export async function getJson<T>(
  path: string,
  schema: z.ZodType<T>,
  query?: URLSearchParams,
): Promise<T> {
  const response = await fetch(apiUrl(path, query), { headers: jsonHeaders });
  return parseResponse("GET", path, response, schema);
}

export async function findJson<T>(path: string, schema: z.ZodType<T>): Promise<T | null> {
  const response = await fetch(apiUrl(path), { headers: jsonHeaders });
  if (response.status === notFoundStatus) {
    return null;
  }

  return parseResponse("GET", path, response, schema);
}

export async function postJson<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  return sendJson("POST", path, body, schema);
}

export async function patchJson<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  return sendJson("PATCH", path, body, schema);
}

// A delete answers with no body.
export async function deleteResource(path: string): Promise<void> {
  const response = await fetch(apiUrl(path), { method: "DELETE", headers: jsonHeaders });
  if (!response.ok) {
    throw await failureOf("DELETE", path, response);
  }
}

async function sendJson<T>(
  method: "POST" | "PATCH",
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method,
    headers: { ...jsonHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse(method, path, response, schema);
}

const jsonHeaders = { Accept: "application/json" } as const;

// Resolved against the page origin so the same call works in the browser and under jsdom.
function apiUrl(path: string, query?: URLSearchParams): URL {
  const url = new URL(`${env.VITE_API_BASE_URL}${path}`, window.location.origin);
  if (query !== undefined) {
    url.search = query.toString();
  }

  return url;
}

async function parseResponse<T>(
  method: string,
  path: string,
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!response.ok) {
    throw await failureOf(method, path, response);
  }

  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ApiError(
      response.status,
      path,
      `${method} ${path} returned an unexpected body:\n${z.prettifyError(parsed.error)}`,
    );
  }

  return parsed.data;
}

async function failureOf(method: string, path: string, response: Response): Promise<ApiError> {
  const problem = problemSchema.safeParse(await response.json().catch(() => null));
  const message = `${method} ${path} failed: HTTP ${response.status}`;
  return problem.success
    ? new ApiError(response.status, path, `${message}: ${problem.data.detail ?? ""}`, problem.data)
    : new ApiError(response.status, path, message);
}
