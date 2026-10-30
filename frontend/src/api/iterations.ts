// Calls the iterations endpoints; what they take and answer is in @vera/contract/iterations.

import type {
  CancellationRequest,
  CancellationResult,
  Overrule,
  PageCount,
  Publication,
  PublicationResult,
  RecheckResult,
  Reclassification,
  ReclassificationResult,
  ReleaseResult,
} from "@vera/contract/iterations";
import {
  cancellationResultSchema,
  publicationResultSchema,
  recheckResultSchema,
  reclassificationResultSchema,
  releaseResultSchema,
} from "@vera/contract/iterations";
import { iterationActionRoute, iterationLinkRoute } from "@vera/contract/routes";
import { deleteJson, postJson } from "@/api/http";

// ---------------------------------------------------------------- calls

export async function reclassifyIteration(
  iterationId: string,
  reclassification: Reclassification,
): Promise<ReclassificationResult> {
  return postJson(
    iterationActionRoute(iterationId, "reclassify"),
    reclassification,
    reclassificationResultSchema,
  );
}

export async function addLink(
  iterationId: string,
  publication: Publication,
): Promise<PublicationResult> {
  return postJson(
    iterationActionRoute(iterationId, "publish"),
    publication,
    publicationResultSchema,
  );
}

export async function replaceLink(
  iterationId: string,
  linkId: string,
  publication: Publication,
): Promise<PublicationResult> {
  return postJson(
    iterationLinkRoute(iterationId, linkId, "replace"),
    publication,
    publicationResultSchema,
  );
}

export async function makeLinkPrimary(
  iterationId: string,
  linkId: string,
): Promise<PublicationResult> {
  return postJson(iterationLinkRoute(iterationId, linkId, "primary"), {}, publicationResultSchema);
}

export async function removeLink(iterationId: string, linkId: string): Promise<PublicationResult> {
  return deleteJson(iterationLinkRoute(iterationId, linkId), publicationResultSchema);
}

export async function enterPageCount(
  iterationId: string,
  pageCount: PageCount,
): Promise<RecheckResult> {
  return postJson(iterationActionRoute(iterationId, "page-count"), pageCount, recheckResultSchema);
}

export async function recheckIteration(iterationId: string): Promise<RecheckResult> {
  return postJson(iterationActionRoute(iterationId, "recheck"), {}, recheckResultSchema);
}

export async function cancelIteration(
  iterationId: string,
  cancellation: CancellationRequest,
): Promise<CancellationResult> {
  return postJson(
    iterationActionRoute(iterationId, "cancel"),
    cancellation,
    cancellationResultSchema,
  );
}

export async function resumeIteration(iterationId: string): Promise<ReleaseResult> {
  return postJson(iterationActionRoute(iterationId, "resume"), {}, releaseResultSchema);
}

export async function overruleRestriction(
  iterationId: string,
  overrule: Overrule,
): Promise<ReleaseResult> {
  return postJson(iterationActionRoute(iterationId, "overrule"), overrule, releaseResultSchema);
}
