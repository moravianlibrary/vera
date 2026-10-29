import { describe, expect, it } from "vitest";
import {
  recordAct,
  recordError,
  recordPageView,
  setTelemetryUser,
  startTelemetry,
} from "./telemetry";

describe("telemetry facade", () => {
  it("is safe without a configured endpoint", async () => {
    await startTelemetry();
    setTelemetryUser("user");
    expect(() => {
      recordPageView("/documents");
      recordAct("ACT-approve", "done");
      recordError(null, new Error("failure"));
    }).not.toThrow();
  });

  it("does nothing for an act before start", () => {
    expect(() => recordAct("ACT-approve", "refused", 409)).not.toThrow();
  });
});
