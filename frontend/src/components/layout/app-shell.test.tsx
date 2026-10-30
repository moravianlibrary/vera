// The shell's phone navigation advances only when a neighbouring sidebar entry exists.

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSwipeBetween } from "@/hooks/use-swipe-between";

const entries = [
  { id: "documents", path: "/documents", visibleLabel: "Documents" },
  { id: "requests", path: "/requests", visibleLabel: "Requests" },
];

function PageSwipe({ currentId, isOpen = false }: { currentId: string; isOpen?: boolean }) {
  const swipe = useSwipeBetween({
    items: entries,
    idOf: (entry) => entry.id,
    labelOf: (entry) => entry.visibleLabel,
    currentId,
    onSelect: (id) => document.body.setAttribute("data-selected", id),
    isEnabled: !isOpen,
  });
  return (
    <main {...swipe.bind}>
      {isOpen && <div role="dialog" data-state="open" />}
      {swipe.peek?.label}
    </main>
  );
}

function swipeLeft(element: HTMLElement) {
  fireEvent.pointerDown(element, { pointerType: "touch", clientX: 100, clientY: 100 });
  fireEvent.pointerMove(element, { pointerType: "touch", clientX: 40, clientY: 100 });
  fireEvent.pointerUp(element, { pointerType: "touch", clientX: 40, clientY: 100 });
}

describe("AppShell phone navigation", () => {
  beforeEach(() => document.body.removeAttribute("data-selected"));
  it("goes to the next entry on a page swipe", () => {
    render(<PageSwipe currentId="documents" />);
    swipeLeft(screen.getByRole("main"));
    expect(document.body).toHaveAttribute("data-selected", "requests");
  });

  it("does nothing with a sheet open", () => {
    render(<PageSwipe currentId="documents" isOpen />);
    swipeLeft(screen.getByRole("main"));
    expect(document.body).not.toHaveAttribute("data-selected");
  });

  it("does nothing at the last entry", () => {
    render(<PageSwipe currentId="requests" />);
    swipeLeft(screen.getByRole("main"));
    expect(document.body).not.toHaveAttribute("data-selected");
  });
});
