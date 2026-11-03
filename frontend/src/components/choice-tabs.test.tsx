import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type ChoicePanel, ChoiceTabs } from "@/components/choice-tabs";

const panels: ChoicePanel<string>[] = [
  { value: "one", label: "One", content: null },
  { value: "two", label: "Two", content: null },
  { value: "three", label: "Three", content: null },
];

function Tabs() {
  const [value, setValue] = useState("one");
  return <ChoiceTabs value={value} onChange={setValue} panels={panels} label="Ways" />;
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: vi.fn(),
    configurable: true,
  });
});

function setScrollMetrics(scrollWidth: number, clientWidth: number, scrollLeft = 0) {
  const list = screen.getByRole("tablist");
  Object.defineProperties(list, {
    scrollWidth: { configurable: true, value: scrollWidth },
    clientWidth: { configurable: true, value: clientWidth },
    scrollLeft: { configurable: true, value: scrollLeft },
  });
  fireEvent.scroll(list);
}

describe("ChoiceTabs phone scrolling", () => {
  it("does not show scroll buttons when the row fits", () => {
    render(<Tabs />);
    setScrollMetrics(200, 200);

    expect(screen.queryByRole("button", { name: "Scroll left" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Scroll right" })).not.toBeInTheDocument();
  });

  it("labels the scroll buttons when tabs overflow on both sides", () => {
    render(<Tabs />);
    setScrollMetrics(400, 200, 20);

    expect(screen.getByRole("button", { name: "Scroll left" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("button", { name: "Scroll right" })).toHaveAttribute("tabindex", "-1");
  });
});
