// API resource paths, relative to the configured base URL. The client and the mock server both
// read them from here, so a route is renamed in one place.

export const apiRoutes = {
  session: "/session",
  users: "/users",
  categories: "/categories",
  projects: "/projects",
  lists: "/lists",
  batches: "/batches",
  documents: "/documents",
  watchlists: "/watchlists",
  proposalSettings: "/proposals/settings",
  proposalLookup: "/proposals/lookup",
  proposals: "/proposals",
  proposalReview: "/proposal-review",
  proposalBulkApproval: "/proposal-review/bulk-approval",
  proposalCustodies: "/proposal-custodies",
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
