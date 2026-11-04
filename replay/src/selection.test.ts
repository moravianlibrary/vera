import { describe, expect, it } from "bun:test";
import type { RecordingCall } from "./recording";
import { selectScenario } from "./selection";

const call = (method: string, path: string): RecordingCall => ({ method, path, status: 200 });
const endpointOf = (item: RecordingCall) =>
  item.path.startsWith("/api/") ? item.path.split("/")[2] : undefined;

describe("selectScenario", () => {
  it("runs a scenario when all its endpoints are served", () => {
    expect(
      selectScenario(
        { name: "served", calls: [call("GET", "/api/access")] },
        ["access"],
        endpointOf,
      ),
    ).toEqual({ kind: "run" });
  });

  it("leaves an unserved read out while retaining the other calls", () => {
    const read = call("GET", "/api/access");
    const act = call("POST", "/api/proposals");
    expect(
      selectScenario({ name: "partial", calls: [read, act] }, ["proposals"], endpointOf),
    ).toEqual({ kind: "run-without-reads", calls: [act], omitted: [read] });
  });

  it("skips the scenario for an unserved act", () => {
    const act = call("POST", "/api/proposals");
    expect(selectScenario({ name: "act", calls: [act] }, [], endpointOf)).toEqual({
      kind: "skip",
      call: act,
      reason: "server does not serve POST /api/proposals",
    });
  });

  it("skips when no served API call remains after leaving out reads", () => {
    expect(
      selectScenario({ name: "empty", calls: [call("GET", "/api/access")] }, [], endpointOf),
    ).toEqual({ kind: "skip", reason: "server serves none of its calls" });
    expect(
      selectScenario(
        {
          name: "engine-only",
          calls: [call("GET", "/api/access"), call("POST", "/_engine/reset")],
        },
        [],
        endpointOf,
      ),
    ).toEqual({ kind: "skip", reason: "server serves none of its calls" });
  });

  it("skips when a later call needs a value resolved after an unserved read", () => {
    const read = call("GET", "/api/access");
    const dependent = call("GET", "/api/documents/$NEW_DOCUMENT");
    expect(
      selectScenario({ name: "dependent", calls: [read, dependent] }, ["documents"], endpointOf),
    ).toEqual({
      kind: "skip",
      call: read,
      reason: "server does not serve GET /api/access; a later call depends on its answer",
    });
  });
});
