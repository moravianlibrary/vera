import { describe, expect, it } from "bun:test";
import { loginPathFor, safeReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  it("keeps a VERA path and its query", () => {
    expect(safeReturnTo("/documents?q=x")).toBe("/documents?q=x");
  });

  it("uses the start page for a missing or empty value", () => {
    expect(safeReturnTo(null)).toBe("/");
    expect(safeReturnTo("")).toBe("/");
  });

  it("rejects outside and protocol-relative addresses", () => {
    expect(safeReturnTo("https://evil.example/")).toBe("/");
    expect(safeReturnTo("//evil.example")).toBe("/");
    expect(safeReturnTo("/\\evil.example")).toBe("/");
  });

  it("rejects the login and signed-out pages", () => {
    expect(safeReturnTo("/login?returnTo=/x")).toBe("/");
    expect(safeReturnTo("/signed-out")).toBe("/");
  });
});

describe("loginPathFor", () => {
  it("encodes the current page and query", () => {
    expect(loginPathFor({ pathname: "/lists", search: "?state=x" })).toBe(
      "/login?returnTo=%2Flists%3Fstate%3Dx",
    );
  });

  it("does not add a return target for the start page", () => {
    expect(loginPathFor({ pathname: "/", search: "" })).toBe("/login");
  });
});
