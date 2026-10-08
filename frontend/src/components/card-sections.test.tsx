// A section the view controls can be toggled; when it is the only populated section, its
// heading disappears and its content remains visible regardless of a saved closed state.

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { CardSections } from "@/components/card-sections";

function Board({
  hideHeading = false,
  startsOpen = true,
}: {
  hideHeading?: boolean;
  startsOpen?: boolean;
}) {
  const [isOpen, setOpen] = useState(startsOpen);
  return (
    <CardSections
      sections={[
        {
          id: "proposed",
          title: "Proposed",
          items: ["Project A"],
          isHeadingHidden: hideHeading,
          isOpen,
          onOpenChange: setOpen,
        },
      ]}
      itemId={(item) => item}
      renderCard={(item) => <span>{item}</span>}
      columns={{ notebook: 1 }}
    />
  );
}

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (media: string) => ({
      media,
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});

describe("CardSections headings", () => {
  it("toggles a controlled section", () => {
    render(<Board />);
    const heading = screen.getByText(/Proposed/);
    const section = heading.closest("details");
    expect(section?.open).toBe(true);
    fireEvent.click(heading);
    expect(section?.open).toBe(false);
    fireEvent.click(heading);
    expect(section?.open).toBe(true);
  });

  it("shows a single section directly", () => {
    render(<Board hideHeading startsOpen={false} />);
    expect(screen.queryByText("Proposed")).toBeNull();
    expect(screen.getByText("Project A")).toBeTruthy();
  });
});
