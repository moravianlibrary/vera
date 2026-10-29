import { describe, expect, it } from "vitest";
import { paneStateOf } from "@/components/pane-state";

describe("paneStateOf", () => {
  it("has no pane when nothing is selected, even after a failure", () => {
    const failure = { text: "Could not load.", onRetry: () => {} };
    expect(paneStateOf(null, undefined, "Gone", failure)).toEqual({ kind: "none" });
  });

  it("distinguishes loading from a failed lookup", () => {
    const failure = { text: "Could not load.", onRetry: () => {} };
    expect(paneStateOf("record", undefined, "Gone")).toEqual({ kind: "loading" });
    expect(paneStateOf("record", undefined, "Gone", failure)).toEqual({ kind: "error", failure });
  });

  it("distinguishes gone and ready details", () => {
    expect(paneStateOf("record", null, "Gone")).toEqual({ kind: "gone", text: "Gone" });
    expect(paneStateOf("record", { id: "record" }, "Gone")).toEqual({
      kind: "ready",
      detail: { id: "record" },
    });
  });
});
