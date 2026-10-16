// A refusal as the engine answers it: RFC 9457 Problem Details with VERA's `code` and `errors`
// (contract/src/problem.ts, ACT-refusal). A refusal with no code of its own takes its status's.

import type { Problem } from "@vera/contract/problem";

const problemsOf: Record<number, { code?: string; title: string }> = {
  400: { code: "bad_request", title: "Bad request" },
  401: { title: "Not signed in" },
  403: { code: "forbidden", title: "Forbidden" },
  404: { code: "not_found", title: "Not found" },
  405: { code: "method_not_allowed", title: "Method not allowed" },
  409: { code: "conflict", title: "Conflict" },
  422: { code: "invalid", title: "Not accepted" },
  429: { code: "rate_limited", title: "Too many requests" },
  500: { code: "server_error", title: "Server error" },
};

export interface FieldError {
  field: string;
  message: string;
}

export function problem(
  status: number,
  detail: string,
  options: { code?: string; errors?: FieldError[] } = {},
): Response {
  const known = problemsOf[status] ?? { title: "Error" };
  const code = options.code ?? known.code;
  const body: Problem = {
    type: code === undefined ? "about:blank" : `https://vera.mzk.cz/problems/${code}`,
    title: known.title,
    status,
    detail,
    ...(code === undefined ? {} : { code }),
    ...(options.errors === undefined ? {} : { errors: options.errors }),
  };
  return Response.json(body, {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

// Every issue named by the field it is on, for a form to show beside it.
export function fieldErrorsOf(issues: readonly { path: PropertyKey[]; message: string }[]) {
  return issues.map((issue) => ({
    field: issue.path.map(String).join("."),
    message: issue.message,
  }));
}
