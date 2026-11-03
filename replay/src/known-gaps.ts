export const knownGaps = [
  // This list only shrinks: the engine gains what the mock answers, or DEC-0022 leaves the area to the backend.
  {
    recording: "base-access.json",
    scenario: "users-and-groups-index-impacts-and-accounts",
    reason:
      "the engine's Users & Groups index lacks projects, shared watchlists and properties, which remain the backend's",
  },
];
