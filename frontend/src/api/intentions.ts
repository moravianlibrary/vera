// Calls the intentions endpoints; what they take and answer is in @vera/contract/intentions.

import type {
  CorrectionPreview,
  IntentionDeletion,
  IntentionDraft,
  IntentionIndex,
  IntentionPreview,
  IntentionPreviewRequest,
  IntentionRow,
  IntentionTemplateDraft,
  IntentionTemplateRow,
} from "@vera/contract/intentions";
import {
  correctionPreviewSchema,
  intentionDeletionSchema,
  intentionIndexSchema,
  intentionPreviewSchema,
  intentionRowSchema,
  intentionTemplateRowSchema,
} from "@vera/contract/intentions";
import { apiRoutes } from "@vera/contract/routes";
import { deleteResource, getJson, postJson, putJson } from "@/api/http";

// ---------------------------------------------------------------- calls

const intentionRoute = (intentionId: string) =>
  `${apiRoutes.intentions}/${encodeURIComponent(intentionId)}`;

export async function listIntentionIndex(): Promise<IntentionIndex> {
  return getJson(apiRoutes.intentionIndex, intentionIndexSchema);
}

export async function previewIntention(
  request: IntentionPreviewRequest,
): Promise<IntentionPreview> {
  return postJson(apiRoutes.intentionPreview, request, intentionPreviewSchema);
}

export async function createIntention(draft: IntentionDraft): Promise<IntentionRow> {
  return postJson(apiRoutes.intentions, draft, intentionRowSchema);
}

export async function saveIntention(
  intentionId: string,
  draft: IntentionDraft,
): Promise<IntentionRow> {
  return putJson(intentionRoute(intentionId), draft, intentionRowSchema);
}

export async function archiveIntention(intentionId: string): Promise<IntentionRow> {
  return postJson(`${intentionRoute(intentionId)}/archive`, {}, intentionRowSchema);
}

export async function unarchiveIntention(intentionId: string): Promise<IntentionRow> {
  return postJson(`${intentionRoute(intentionId)}/unarchive`, {}, intentionRowSchema);
}

export async function previewIntentionDeletion(intentionId: string): Promise<IntentionDeletion> {
  return getJson(`${intentionRoute(intentionId)}/deletion`, intentionDeletionSchema);
}

export async function previewCorrection(
  intentionId: string,
  pages: number,
): Promise<CorrectionPreview> {
  return getJson(
    `${intentionRoute(intentionId)}/correction?pages=${pages}`,
    correctionPreviewSchema,
  );
}

export async function deleteIntention(intentionId: string): Promise<void> {
  return deleteResource(intentionRoute(intentionId));
}

export async function createIntentionTemplate(
  draft: IntentionTemplateDraft,
): Promise<IntentionTemplateRow> {
  return postJson(apiRoutes.intentionTemplates, draft, intentionTemplateRowSchema);
}

export async function saveIntentionTemplate(
  templateId: string,
  draft: IntentionTemplateDraft,
): Promise<IntentionTemplateRow> {
  return putJson(
    `${apiRoutes.intentionTemplates}/${encodeURIComponent(templateId)}`,
    draft,
    intentionTemplateRowSchema,
  );
}
