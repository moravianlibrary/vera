// Calls the validations endpoints; what they take and answer is in @vera/contract/validations.

import { apiRoutes, validationRoute, verdictRoute } from "@vera/contract/routes";
import type {
  Acceptance,
  Denial,
  Revocation,
  ValidationDetail,
  ValidationGrouping,
  ValidationPage,
  ValidationQuery,
  VerdictResult,
} from "@vera/contract/validations";
import {
  toValidationSearchParams,
  validationDetailSchema,
  validationGroupingParam,
  validationPageSchema,
  validationSliceParams,
  validationSliceSize,
  verdictResultSchema,
} from "@vera/contract/validations";
import { findJson, getJson, postJson } from "@/api/http";

// ---------------------------------------------------------------- calls

interface ValidationListOptions {
  readonly grouping?: ValidationGrouping | null;
  readonly cursor?: string | null;
  readonly limit?: number;
}

export async function listValidations(
  query: ValidationQuery,
  { grouping = null, cursor = null, limit = validationSliceSize }: ValidationListOptions = {},
): Promise<ValidationPage> {
  const params = toValidationSearchParams(query);
  if (grouping !== null) {
    params.set(validationGroupingParam, grouping);
  }

  if (cursor !== null) {
    params.set(validationSliceParams.cursor, cursor);
  }

  params.set(validationSliceParams.limit, String(limit));
  return getJson(apiRoutes.validations, validationPageSchema, params);
}

// Null when the iteration is not (or no longer) held here within the caller's custody.
export async function findValidation(iterationId: string): Promise<ValidationDetail | null> {
  return findJson(validationRoute(iterationId), validationDetailSchema);
}

export async function acceptDefects(
  iterationId: string,
  acceptance: Acceptance,
): Promise<VerdictResult> {
  return postJson(verdictRoute(iterationId, "accept"), acceptance, verdictResultSchema);
}

export async function denyDefects(iterationId: string, denial: Denial): Promise<VerdictResult> {
  return postJson(verdictRoute(iterationId, "deny"), denial, verdictResultSchema);
}

export async function revokeAcceptance(
  iterationId: string,
  revocation: Revocation,
): Promise<VerdictResult> {
  return postJson(verdictRoute(iterationId, "revoke"), revocation, verdictResultSchema);
}
