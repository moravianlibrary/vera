import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DialogShell } from "@/components/dialogs/dialog-shell";

describe("DialogShell", () => {
  it("shows the disabled primary's reason as its title", () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    render(
      <DialogShell
        isOpen
        onClose={vi.fn()}
        title="Example"
        description="Example dialog"
        primary={{
          label: "Continue",
          isDisabled: true,
          disabledReason: "Add an item first",
          onSelect: vi.fn(),
        }}
      >
        Body
      </DialogShell>,
    );

    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute(
      "title",
      "Add an item first",
    );
  });
});
