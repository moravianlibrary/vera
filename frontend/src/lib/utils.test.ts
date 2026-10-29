import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps a named font size alongside a text color", () => {
    expect(cn("px-3 text-ui font-medium text-foreground")).toBe(
      "px-3 text-ui font-medium text-foreground",
    );
  });

  it("keeps a caption size alongside a text color", () => {
    expect(cn("text-caption text-primary")).toBe("text-caption text-primary");
  });

  it("merges font sizes and named shadows", () => {
    expect(cn("text-sm", "text-ui")).toBe("text-ui");
    expect(cn("shadow-sm", "shadow-peek")).toBe("shadow-peek");
  });
});
