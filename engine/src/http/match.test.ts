import { describe, expect, it } from "bun:test";
import { matchPath } from "./match";

describe("request decision routes", () => {
  it("keeps the batch approval path distinct from a document approval", () => {
    expect(
      matchPath("/requests/batches/:batchId/approve", "/requests/batches/B-1/approve"),
    ).toEqual({ batchId: "B-1" });
    expect(matchPath("/requests/:documentId/approve", "/requests/batches/B-1/approve")).toBeNull();
  });
});
