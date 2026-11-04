import type { RecordingCall } from "./recording";

export type ScenarioCalls = { name: string; calls: RecordingCall[] };

export type ScenarioSelection =
  | { kind: "run" }
  | { kind: "run-without-reads"; calls: RecordingCall[]; omitted: RecordingCall[] }
  | { kind: "skip"; call?: RecordingCall; reason: string };

function served(
  call: RecordingCall,
  servedEndpoints: string[],
  endpointOf: (call: RecordingCall) => string | undefined,
) {
  const name = endpointOf(call);
  if (name !== undefined) return servedEndpoints.includes(name);
  return !new URL(call.path, "http://recording.invalid").pathname.startsWith("/api/");
}

export function selectScenario(
  scenario: ScenarioCalls,
  servedEndpoints: string[],
  endpointOf: (call: RecordingCall) => string | undefined,
): ScenarioSelection {
  const omitted: RecordingCall[] = [];
  for (const [index, call] of scenario.calls.entries()) {
    if (served(call, servedEndpoints, endpointOf)) continue;
    if (call.method !== "GET") {
      return { kind: "skip", call, reason: `server does not serve ${call.method} ${call.path}` };
    }
    if (scenario.calls.slice(index + 1).some((later) => later.path.includes("$NEW_DOCUMENT"))) {
      return {
        kind: "skip",
        call,
        reason: `server does not serve ${call.method} ${call.path}; a later call depends on its answer`,
      };
    }
    // Reads change nothing, so leaving one out cannot change what the acts after it answer.
    omitted.push(call);
  }
  const calls = scenario.calls.filter((call) => !omitted.includes(call));
  if (
    !calls.some((call) => {
      const name = endpointOf(call);
      return name !== undefined && servedEndpoints.includes(name);
    })
  ) {
    return { kind: "skip", reason: "server serves none of its calls" };
  }
  return omitted.length === 0 ? { kind: "run" } : { kind: "run-without-reads", calls, omitted };
}
