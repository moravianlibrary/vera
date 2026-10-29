import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { QueryState } from "@/components/query-state";
import { i18n } from "@/i18n";

function renderQueryState(element: ReactNode) {
  return render(<I18nextProvider i18n={i18n}>{element}</I18nextProvider>);
}

describe("QueryState", () => {
  it("shows a failure and retries it", () => {
    const onRetry = vi.fn();
    renderQueryState(
      <QueryState isLoading failure={{ text: "Could not load hooks.", onRetry }}>
        <span>Hooks</span>
      </QueryState>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Could not load hooks.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows custom loading text", () => {
    renderQueryState(
      <QueryState isLoading failure={undefined} loadingText="Loading hooks…">
        <span>Hooks</span>
      </QueryState>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading hooks…");
  });

  it("uses the shared loading text by default", () => {
    renderQueryState(
      <QueryState isLoading failure={undefined}>
        <span>Hooks</span>
      </QueryState>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("shows empty text instead of its children", () => {
    renderQueryState(
      <QueryState isLoading={false} failure={undefined} isEmpty emptyText="No hooks.">
        <span>Hooks</span>
      </QueryState>,
    );
    expect(screen.getByText("No hooks.")).toBeInTheDocument();
    expect(screen.queryByText("Hooks")).toBeNull();
  });

  it("shows its children when ready", () => {
    renderQueryState(
      <QueryState isLoading={false} failure={undefined}>
        <span>Hooks</span>
      </QueryState>,
    );
    expect(screen.getByText("Hooks")).toBeInTheDocument();
  });
});
