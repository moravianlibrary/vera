export type KnownGapCall = { method: string; path: string; status?: number };

type KnownGap = {
  recording: string;
  scenario: string;
  reason: string;
  calls?: KnownGapCall[];
};

export const knownGaps: KnownGap[] = [
  // These gaps are limited to behavior reserved for the backend or available only in the mock.
  {
    recording: "base-proposals.json",
    scenario: "b-admin-approve-now",
    reason:
      "the backend runs ingest once approve now approves (L25), so the document is Ready and ingested; the mock does not run ingest",
    calls: [{ method: "GET", path: "/api/documents/$NEW_DOCUMENT" }],
  },
  {
    recording: "base-sign-in.json",
    scenario: "provider-login-mock-only",
    reason:
      "the mock shortcut POST /api/login/pi22/mock answers 204; the backend completes provider login through /_engine/identity/pi22 after a real start and callback",
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
