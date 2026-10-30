import { describe, expect, it } from "bun:test";
import { jobAttributesOf, routeTemplateOf, telemetryUserId } from "./rules";

describe("telemetry rules", () => {
  it("omits a reader only caller", () => expect(telemetryUserId("u1", ["reader"])).toBeNull());
  it("records a caller with staff role", () =>
    expect(telemetryUserId("u1", ["reader", "staff"])).toBe("u1"));
  it("omits an absent caller", () => expect(telemetryUserId(null, ["staff"])).toBeNull());
  it("prefixes API route templates", () =>
    expect(routeTemplateOf("/iterations/:id")).toBe("/api/iterations/:id"));
  it("uses a wildcard for unmatched paths", () => expect(routeTemplateOf(null)).toBe("/api/*"));
  it("keeps string ids and drops other payload fields", () =>
    expect(jobAttributesOf("send", { requestId: "R1", email: "a@b", count: 4 })).toEqual({
      "vera.job.kind": "send",
      requestId: "R1",
    }));
  it("drops a non-object payload", () =>
    expect(jobAttributesOf("send", "secret")).toEqual({ "vera.job.kind": "send" }));
});
