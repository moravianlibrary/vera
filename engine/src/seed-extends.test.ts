import { describe, expect, it } from "bun:test";
import { extendSeed } from "./seed-extends";

describe("seed extensions", () => {
  it("lays child records over parent collections", () => {
    const result = extendSeed(
      {
        name: "installation",
        collections: {
          roles: [
            { id: "reader", x: 1 },
            { id: "admin", x: 1 },
          ],
          requestCustodies: [{ id: "pc0", memberIds: [] }],
          userAccess: { u1: 1 },
        },
      },
      {
        name: "base",
        extends: "installation",
        collections: {
          requestCustodies: [{ id: "pc0", memberIds: ["u3"] }, { id: "pc1" }],
          roles: [{ id: "admin", x: 2 }],
        },
      },
    );

    expect(result.collections).toEqual({
      roles: [
        { id: "reader", x: 1 },
        { id: "admin", x: 2 },
      ],
      requestCustodies: [{ id: "pc0", memberIds: ["u3"] }, { id: "pc1" }],
      userAccess: { u1: 1 },
    });
    expect(result.name).toBe("base");
    expect(result).not.toHaveProperty("extends");
  });

  it("keeps parent-only collections and adds child-only collections", () => {
    const result = extendSeed(
      { collections: { parentOnly: [1] } },
      { collections: { childOnly: [2] } },
    );

    expect(result.collections).toEqual({ parentOnly: [1], childOnly: [2] });
  });

  it("merges keyed collections and fakes key by key", () => {
    const result = extendSeed(
      { collections: { userAccess: { u2: 2 } }, fakes: { b: 2 } },
      { collections: { userAccess: { u1: 1 } }, fakes: { a: 1 } },
    );

    expect((result.collections as Record<string, unknown>).userAccess).toEqual({ u2: 2, u1: 1 });
    expect(result.fakes).toEqual({ b: 2, a: 1 });
  });
});
