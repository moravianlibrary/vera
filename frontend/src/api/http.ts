// The HTTP boundary. Every response is parsed against its schema here, once, so callers receive
// typed and trusted values. A failed request or an unexpected body raises ApiError; an expected
// absence (404 on a lookup) is returned as null by `findJson`.

import { z } from "zod";
import { env } from "@/config/env";

export class ApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(status: number, path: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
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
    throw new ApiError(response.status, path, `DELETE ${path} failed: HTTP ${response.status}`);
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
    throw new ApiError(response.status, path, `${method} ${path} failed: HTTP ${response.status}`);
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
