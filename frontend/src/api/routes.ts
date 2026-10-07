// API resource paths, relative to the configured base URL. The client and the mock server both
// read them from here, so a route is renamed in one place.

export const apiRoutes = {
  session: "/session",
  userSettings: "/session/settings",
  users: "/users",
  categories: "/categories",
  // Categories, the page: the tree with its numbers, custody and Overall's mix, read-only.
  categoryIndex: "/categories/overview",
  projects: "/projects",
  // Projects, the page: every project the caller sees with its numbers worked out.
  projectIndex: "/projects/overview",
  groups: "/groups",
  // Intentions, the page: every intention the caller sees with what it counts.
  intentionIndex: "/intentions/overview",
  intentions: "/intentions",
  // What a draft would count and the mix it would read, before it is saved.
  intentionPreview: "/intentions/preview",
  intentionTemplates: "/intention-templates",
  lists: "/lists",
  digitizationLists: "/digitization-lists",
  digitizationListPool: "/digitization-lists/pool",
  listGenerators: "/digitization-lists/generators",
  listGeneration: "/digitization-lists/generate",
  // The intentions a draft can be shaped by.
  listShapes: "/digitization-lists/shapes",
  // What a draft counts towards, and its fill against one intention's mix.
  listReading: "/digitization-lists/reading",
  batches: "/batches",
  documents: "/documents",
  iterations: "/iterations",
  watchlists: "/watchlists",
  proposalSettings: "/proposals/settings",
  proposalLookup: "/proposals/lookup",
  proposals: "/proposals",
  proposalReview: "/proposal-review",
  proposalCustodies: "/proposal-custodies",
  validations: "/validations",
  messageChannels: "/message-channels",
  messageHandOff: "/messages/hand-off",
} as const;

export function documentRoute(documentId: string): string {
  return `${apiRoutes.documents}/${encodeURIComponent(documentId)}`;
}

export function categoryRoute(categoryId: string): string {
  return `${apiRoutes.categories}/${encodeURIComponent(categoryId)}`;
}

// What is done to one category besides editing it: its custody set, what removing or refining it
// would change, and refining it (permissions.md §3, Categories).
export const categoryActions = ["custody", "impact", "refine"] as const;
export type CategoryAction = (typeof categoryActions)[number];

export function categoryActionRoute(categoryId: string, action: CategoryAction): string {
  return `${categoryRoute(categoryId)}/${action}`;
}

export function projectRoute(projectId: string): string {
  return `${apiRoutes.projects}/${encodeURIComponent(projectId)}`;
}

export function intentionRoute(intentionId: string): string {
  return `${apiRoutes.intentions}/${encodeURIComponent(intentionId)}`;
}

export function digitizationListRoute(listId: string): string {
  return `${apiRoutes.digitizationLists}/${encodeURIComponent(listId)}`;
}

export function digitizationListMemberRoute(listId: string, iterationId: string): string {
  return `${digitizationListRoute(listId)}/items/${encodeURIComponent(iterationId)}`;
}

export function watchlistRoute(watchlistId: string): string {
  return `${apiRoutes.watchlists}/${encodeURIComponent(watchlistId)}`;
}

export function proposalReviewRoute(documentId: string): string {
  return `${apiRoutes.proposalReview}/${encodeURIComponent(documentId)}`;
}

export function proposalDecisionRoute(documentId: string, decision: "approve" | "decline"): string {
  return `${proposalReviewRoute(documentId)}/${decision}`;
}

// Everything open a batch asked for, approved at once (status-model.md §2.8).
export function proposalBulkApprovalRoute(batchId: string): string {
  return `${apiRoutes.proposalReview}/batches/${encodeURIComponent(batchId)}/approve`;
}

// The verdicts on one iteration's defects, each its own permission (permissions.md §3).
export const verdictActions = ["accept", "deny", "revoke"] as const;
export type VerdictAction = (typeof verdictActions)[number];

export function validationRoute(iterationId: string): string {
  return `${apiRoutes.validations}/${encodeURIComponent(iterationId)}`;
}

export function verdictRoute(iterationId: string, action: VerdictAction): string {
  return `${validationRoute(iterationId)}/${action}`;
}

// What may be done to an iteration from the Documents and Validations panes: each is its own
// action, so the server checks each permission against the iteration's category (permissions.md
// §3). Entering a page count runs the checks again; a recheck runs them over the record as the
// catalog has it now.
export const iterationActions = [
  "reclassify",
  "publish",
  "page-count",
  "recheck",
  "cancel",
] as const;
export type IterationAction = (typeof iterationActions)[number];

export function iterationActionRoute(iterationId: string, action: IterationAction): string {
  return `${apiRoutes.iterations}/${encodeURIComponent(iterationId)}/${action}`;
}

// Every failed addition of a batch, retried at once: the batch is the unit an admin retries.
export function batchRetryRoute(batchId: string): string {
  return `${apiRoutes.batches}/${encodeURIComponent(batchId)}/retry`;
}
