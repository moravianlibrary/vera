// A refusal as the server answers it: RFC 9457 Problem Details (decided 2026-10-06), with VERA's
// `code` and `errors` extensions. A refusal with no code of its own takes its status's.

import type { RefusalCode } from "@vera/contract/refusal-codes";
import { HttpResponse } from "msw";
import type { z } from "zod";
import type { Refusal } from "@/mocks/mutations";

const problemsOf = {
  403: { code: "forbidden", title: "Forbidden" },
  404: { code: "not_found", title: "Not found" },
  409: { code: "conflict", title: "Conflict" },
  410: { code: "gone", title: "Gone" },
  422: { code: "invalid", title: "Not accepted" },
  429: { code: "rate_limited", title: "Too many requests" },
} as const satisfies Record<Refusal["status"], { code: RefusalCode; title: string }>;

interface FieldError {
  pointer: string;
  code: string;
  detail?: string;
}

export function problemResponse({ status, message, code }: Refusal, errors?: FieldError[]) {
  const problem = problemsOf[status];
  const key = code ?? problem.code;
  return HttpResponse.json(
    {
      type: `https://vera.mzk.cz/problems/${key}`,
      title: problem.title,
      status,
      detail: message,
      code: key,
      ...(errors === undefined ? {} : { errors }),
    },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

// A body the schema rejected: every issue is named by the field it is on, for a form to show
// beside it.
export function invalidResponse(error: z.ZodError) {
  return problemResponse(
    {
      status: 422,
      message: error.issues[0]?.message ?? "Not accepted",
      ...(error.issues[0]?.code === "custom" &&
      ["hook.condition_kind", "hook.condition_invalid"].includes(error.issues[0].params?.code)
        ? { code: error.issues[0].params?.code }
        : {}),
    },
    error.issues.map((issue) => ({
      pointer:
        issue.path.length === 0
          ? ""
          : `/${issue.path.map((part) => String(part).replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`,
      code: issue.code === "custom" ? (issue.params?.code ?? "invalid") : issue.code,
      detail: issue.message,
    })),
  );
}
