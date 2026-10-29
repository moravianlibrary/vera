import { describe, expect, it } from "vitest";
import { redactedUrl, routeTemplateOf, telemetryUserId, withoutQuery } from "./rules";

describe("telemetry rules", () => {
  it("does not identify a reader", () => {
    expect(telemetryUserId({ user: { id: "u1" }, roleIds: ["reader"] })).toBeNull();
  });
  it("identifies a person with a role beyond reader", () => {
    expect(telemetryUserId({ user: { id: "u1" }, roleIds: ["reader", "staff"] })).toBe("u1");
  });
  it("does not identify a visitor", () => {
    expect(telemetryUserId(undefined)).toBeNull();
  });
  it("joins outer and leaf route patterns", () => {
    expect(routeTemplateOf(["/", "documents"])).toBe("/documents");
  });
  it("keeps parameter patterns", () => {
    expect(routeTemplateOf(["/", "projects/:projectId"])).toBe("/projects/:projectId");
  });
  it("uses the root for no patterns and index routes", () => {
    expect(routeTemplateOf([])).toBe("/");
    expect(routeTemplateOf(["/", undefined])).toBe("/");
  });
  it("removes query and fragment from URLs", () => {
    expect(withoutQuery("http://x/api/a?q=secret#f")).toBe("http://x/api/a");
  });
  it("redacts short notification preference tokens", () => {
    expect(redactedUrl("http://x/api/notification-preferences/abcDEF123")).toBe(
      "http://x/api/notification-preferences/:token",
    );
  });
  it("redacts long base64url path segments", () => {
    expect(redactedUrl("http://x/api/items/abcdefghijklmnopqrstuvwxyz123456")).toBe(
      "http://x/api/items/:token",
    );
  });
  it("keeps short path identifiers", () => {
    expect(redactedUrl("http://x/api/access/users/u3/roles")).toBe(
      "http://x/api/access/users/u3/roles",
    );
  });
});
