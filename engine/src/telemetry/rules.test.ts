import { describe, expect, it } from "bun:test";
import { auditRecordOf, jobAttributesOf, routeTemplateOf, telemetryUserId } from "./rules";

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
  it("keeps a reader anonymous and strips reasons from audit records", () => {
    const result = auditRecordOf(
      {
        code: "user.created",
        at: "2026-06-25T08:40:00.000Z",
        correlationId: "c1",
        subjectKind: "user",
        subjectId: "u1",
        actor: { kind: "reader" },
        data: { changes: [] },
        reason: { public: "private", internal: "private" },
      },
      { traceId: null },
    );
    expect(result.actor).toEqual({ kind: "reader" });
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("includes a staff name and maps configuration changes without history data", () => {
    const result = auditRecordOf(
      {
        code: "user.roles_changed",
        at: "2026-06-25T08:40:00.000Z",
        correlationId: "c1",
        subjectKind: "user",
        subjectId: "u1",
        subjectName: "Ada",
        actor: { kind: "user", userId: "u2", name: "Grace" },
        data: { changes: [{ field: "roleIds", from: [], to: ["admin"] }] },
      },
      { traceId: "trace" },
    );
    expect(result.subject.name).toBe("Ada");
    expect(result.actor).toEqual({ kind: "user", userId: "u2", name: "Grace" });
    expect(result.changes).toEqual([{ field: "roleIds", from: [], to: ["admin"] }]);
    expect(result.data).toBeNull();
  });
});
