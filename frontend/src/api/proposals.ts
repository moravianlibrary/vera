// Calls the proposals endpoints; what they take and answer is in @vera/contract/proposals.

import type {
  BarcodeReading,
  CatalogHit,
  PhotoReading,
  ProposalCheck,
  ProposalDraft,
  ProposalItem,
  ProposalReport,
  ProposalSettings,
  RateLimitStatus,
  RecordLink,
} from "@vera/contract/proposals";
import {
  barcodeReadingSchema,
  catalogHitSchema,
  entryAnswerSchema,
  entryAskOf,
  photoReadingSchema,
  proposalCheckSchema,
  proposalReportSchema,
  proposalSettingsSchema,
  rateLimitStatusSchema,
  recordLinkReadingSchema,
} from "@vera/contract/proposals";
import { apiRoutes } from "@vera/contract/routes";
import { z } from "zod";
import { getJson, postForm, postJson } from "@/api/http";

export async function searchCatalogs(
  query: string,
  catalogId: string | null,
): Promise<CatalogHit[]> {
  const params = new URLSearchParams({ q: query });
  if (catalogId !== null) {
    params.set("catalog", catalogId);
  }

  return getJson(apiRoutes.proposalCatalogSearch, z.array(catalogHitSchema), params);
}

export async function readRecordLink(link: RecordLink): Promise<{ catalogId: string }> {
  return postJson(apiRoutes.proposalRecordLink, link, recordLinkReadingSchema);
}

export async function readPhoto(photo: File): Promise<PhotoReading> {
  const body = new FormData();
  body.set("photo", photo);
  return postForm(apiRoutes.proposalPhoto, body, photoReadingSchema);
}

// Where the browser cannot read the camera, one photo per book is read on the server.
export async function readBarcode(photo: File): Promise<BarcodeReading> {
  const body = new FormData();
  body.set("photo", photo);
  return postForm(apiRoutes.proposalBarcode, body, barcodeReadingSchema);
}

export async function getProposalSettings(): Promise<ProposalSettings> {
  return getJson(apiRoutes.proposalSettings, proposalSettingsSchema);
}

export async function readProposalEntry(parameters: URLSearchParams, page: string | null) {
  const ask = entryAskOf(parameters);
  return postJson(
    apiRoutes.proposalEntry,
    {
      sourceId: ask.sourceId,
      parameters: Object.fromEntries(parameters.entries()),
      page,
    },
    entryAnswerSchema,
  );
}

// One answer per item, in order.
export async function checkProposalItems(items: ProposalItem[]): Promise<ProposalCheck[]> {
  return postJson(apiRoutes.proposalLookup, { items }, z.array(proposalCheckSchema));
}

export async function submitProposal(draft: ProposalDraft): Promise<ProposalReport> {
  return postJson(apiRoutes.proposals, draft, proposalReportSchema);
}

// The remaining rate limit count for the current user, checked before submit.
export async function getRateLimitStatus(): Promise<RateLimitStatus> {
  return getJson(apiRoutes.proposalRateLimit, rateLimitStatusSchema);
}
