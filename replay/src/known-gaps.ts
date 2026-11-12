export type KnownGapCall = { method: string; path: string; status?: number };

type KnownGap = {
  recording: string;
  scenario: string;
  reason: string;
  calls?: KnownGapCall[];
};

export const knownGaps: KnownGap[] = [
  // This list only shrinks: the engine gains what the mock answers, or DEC-0022 leaves the area to the backend.
  // The one exception is what only the backend does by decision (ingest, L25), noted as such.
  {
    recording: "base-access.json",
    scenario: "users-and-groups-index-impacts-and-accounts",
    reason: "the engine's Users & Groups index lacks projects, shared watchlists and properties",
    calls: [{ method: "GET", path: "/api/access" }],
  },
  {
    recording: "base-access-acts.json",
    scenario: "access-index-and-role-management",
    reason: "the engine's Users & Groups index lacks projects, shared watchlists and properties",
    calls: [{ method: "GET", path: "/api/access" }],
  },
  {
    recording: "base-access-acts.json",
    scenario: "local-account-and-user-access-acts",
    reason: "the engine's Users & Groups index lacks projects, shared watchlists and properties",
    calls: [{ method: "GET", path: "/api/access" }],
  },
  {
    recording: "base-proposals.json",
    scenario: "b-admin-approve-now",
    reason:
      "the backend runs ingest once approve now approves (L25), so the document is Ready and ingested; the mock and the engine run no ingest",
    calls: [{ method: "GET", path: "/api/documents/$NEW_DOCUMENT" }],
  },
  {
    recording: "base-sign-in.json",
    scenario: "provider-login-mock-only",
    reason:
      "the mock shortcut POST /api/login/pi22/mock answers 204; the engine completes provider login through /_engine/identity/pi22 after a real start and callback",
  },
];

export function knownGapCall(
  recording: string,
  scenario: string,
  call: Pick<KnownGapCall, "method" | "path">,
): KnownGapCall | undefined {
  return knownGaps
    .find((gap) => gap.recording === recording && gap.scenario === scenario)
    ?.calls?.find((known) => known.method === call.method && known.path === call.path);
}
