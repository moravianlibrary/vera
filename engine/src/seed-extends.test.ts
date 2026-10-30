import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extendSeed } from "@vera/contract/seed-extends";
import { readSeed } from "./seed";

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

  it("refuses an extension loop and names its path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vera-seed-loop-"));
    try {
      await writeFile(join(directory, "alpha.json"), JSON.stringify({ extends: "beta" }));
      await writeFile(join(directory, "beta.json"), JSON.stringify({ extends: "alpha" }));
      expect(() => readSeed("alpha", directory)).toThrow(
        "seed alpha extends itself through alpha -> beta -> alpha",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
