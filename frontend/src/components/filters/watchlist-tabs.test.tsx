// Saved filters follow the live query across views; an unmatched query can be stored as a new
// watchlist or replace one the caller may edit.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { listWatchlists } from "@/api/watchlists";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}

describe("WatchlistTabs", () => {
  it("tracks the full live filter and offers Current search only when no saved tab matches", async () => {
    server.use(...createHandlers("staff"));
    const onOpen = vi.fn();
    const props = {
      view: "projects" as const,
      openedId: "W-shared-9",
      canShare: false,
      onOpen,
      onDetach: vi.fn(),
      isBare: false,
    };
    const { rerender } = render(<WatchlistTabs {...props} filter={{ state: "Proposed" }} />, {
      wrapper: Providers,
    });

    const proposed = await screen.findByRole("button", { name: /Proposed/ });
    expect(proposed).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: "Current search" })).toBeNull();

    rerender(<WatchlistTabs {...props} filter={{ state: "Proposed", q: "archive" }} />);
    expect(proposed).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Current search" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    rerender(<WatchlistTabs {...props} filter={{ period: "Ended" }} />);
    expect(screen.getByRole("button", { name: /Ended/ })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: "Current search" })).toBeNull();
  });

  it("can update the filter of an editable watchlist from Current search", async () => {
    server.use(...createHandlers("admin"));
    const onOpen = vi.fn();
    render(
      <WatchlistTabs
        view="projects"
        filter={{ state: "Proposed", q: "archive" }}
        openedId="W-shared-9"
        canShare
        onOpen={onOpen}
        onDetach={vi.fn()}
        isBare={false}
      />,
      { wrapper: Providers },
    );

    await screen.findByRole("button", { name: /Proposed/ });
    fireEvent.click(screen.getByRole("button", { name: "Current search" }));
    expect(screen.getByText("Update an existing watchlist")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update watchlist" }));

    await waitFor(() =>
      expect(onOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "W-shared-9",
          filter: { state: "Proposed", q: "archive" },
        }),
      ),
    );
    expect(
      (await listWatchlists("projects")).find((row) => row.id === "W-shared-9")?.filter,
    ).toEqual({
      state: "Proposed",
      q: "archive",
    });
  });

  it("saves Current search as a new personal watchlist", async () => {
    server.use(...createHandlers("staff"));
    const onOpen = vi.fn();
    render(
      <WatchlistTabs
        view="documents"
        filter={{ q: "archive" }}
        openedId={null}
        canShare={false}
        onOpen={onOpen}
        onDetach={vi.fn()}
        isBare={false}
      />,
      { wrapper: Providers },
    );

    await screen.findByRole("button", { name: /Awaiting a decision/ });
    fireEvent.click(screen.getByRole("button", { name: "Current search" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Save this filter as a watchlist" }), {
      target: { value: "My archive" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save new watchlist" }));

    await waitFor(() =>
      expect(onOpen).toHaveBeenCalledWith(
        expect.objectContaining({ name: "My archive", filter: { q: "archive" } }),
      ),
    );
    expect(
      (await listWatchlists("documents")).find((row) => row.name === "My archive")?.audience,
    ).toEqual({ kind: "personal" });
  });
});
