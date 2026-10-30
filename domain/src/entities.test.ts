import { describe, expect, it } from "bun:test";
import { iterationSchema } from "./entities";

const link = (id: string, url: string, isPrimary: boolean) => ({
  id,
  url,
  instanceId: null,
  setBy: "u1",
  setAt: "2026-10-30T09:00:00Z",
  isPrimary,
});

describe("iteration links (LC-ITER-links)", () => {
  it("refuses two primary links and duplicate URLs", () => {
    const links = iterationSchema.shape.links;
    expect(
      links.safeParse([
        link("a", "https://example.org/a", true),
        link("b", "https://example.org/b", true),
      ]).success,
    ).toBe(false);
    expect(
      links.safeParse([
        link("a", "https://example.org/a", true),
        link("b", "https://example.org/a", false),
      ]).success,
    ).toBe(false);
  });
});
