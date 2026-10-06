// API resource paths, relative to the configured base URL. The client and the mock server both
// read them from here, so a route is renamed in one place.

export const apiRoutes = {
  session: "/session",
  userSettings: "/session/settings",
  users: "/users",
  categories: "/categories",
  projects: "/projects",
  lists: "/lists",
  batches: "/batches",
  documents: "/documents",
  iterations: "/iterations",
  watchlists: "/watchlists",
  proposalSettings: "/proposals/settings",
  proposalLookup: "/proposals/lookup",
  proposals: "/proposals",
  proposalReview: "/proposal-review",
  proposalBulkApproval: "/proposal-review/bulk-approval",
  proposalCustodies: "/proposal-custodies",
  messageChannels: "/message-channels",
  messageHandOff: "/messages/hand-off",
} as const;

export function documentRoute(documentId: string): string {
  return `${apiRoutes.documents}/${encodeURIComponent(documentId)}`;
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

// What may be done to an iteration from the Documents pane: each is its own action, so the server
// checks each permission against the iteration's category (permissions.md §3).
export const iterationActions = ["relink", "reclassify", "publish"] as const;
export type IterationAction = (typeof iterationActions)[number];

export function iterationActionRoute(iterationId: string, action: IterationAction): string {
  return `${apiRoutes.iterations}/${encodeURIComponent(iterationId)}/${action}`;
}

// Every failed addition of a batch, retried at once: the batch is the unit an admin retries.
export function batchRetryRoute(batchId: string): string {
  return `${apiRoutes.batches}/${encodeURIComponent(batchId)}/retry`;
}
