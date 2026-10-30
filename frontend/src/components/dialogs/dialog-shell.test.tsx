import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { i18n } from "@/i18n";

describe("DialogShell", () => {
  it("shows the disabled primary's reason as its title", () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    render(
      <I18nextProvider i18n={i18n}>
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
        </DialogShell>
      </I18nextProvider>,
    );

    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute(
      "title",
      "Add an item first",
    );
  });
});
