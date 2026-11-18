// Saved filters follow the live query across views; an unmatched query can be stored as a new
// watchlist or replace one the caller may edit.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createWatchlist, deleteWatchlist, listWatchlists } from "@/api/watchlists";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { database } from "@/mocks/database";
import { createHandlers } from "@/mocks/handlers";
import { resolveSession } from "@/mocks/session";

// Reconciling every watchlist is slow under the full suite's load; the default 5 s is not enough.
vi.setConfig({ testTimeout: 20_000 });

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
    server.use(...createHandlers("curator"));
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

    const proposed = await screen.findByRole("button", { name: /^System watchlist Proposed/ });
    expect(proposed).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: "Current search" })).toBeNull();

    rerender(<WatchlistTabs {...props} filter={{ state: "Proposed", q: "archive" }} />);
    expect(proposed).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Current search" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    rerender(<WatchlistTabs {...props} filter={{ period: "Ended" }} />);
    expect(screen.getByRole("button", { name: /^System watchlist Ended/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
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
    server.use(...createHandlers("curator"));
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
    fireEvent.click(screen.getByRole("button", { name: "Add Czech name" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name in Czech" }), {
      target: { value: "Můj archiv" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save new watchlist" }));

    await waitFor(() =>
      expect(onOpen).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Můj archiv", filter: { q: "archive" } }),
      ),
    );
    expect(
      (await listWatchlists("documents")).find((row) => row.names.cs === "Můj archiv")?.audience,
    ).toEqual({ kind: "personal" });
    expect(
      (await listWatchlists("documents")).find((row) => row.names.cs === "Můj archiv")?.names,
    ).toEqual({ cs: "Můj archiv" });
  });

  it("lets a manager create a watchlist for selected groups and roles", async () => {
    server.use(...createHandlers("admin"));
    render(
      <WatchlistTabs
        view="documents"
        filter={{ q: "selected-audience-test" }}
        openedId={null}
        canShare
        onOpen={vi.fn()}
        onDetach={vi.fn()}
        isBare={false}
      />,
      { wrapper: Providers },
    );

    await screen.findByRole("button", { name: /Awaiting a decision/ });
    fireEvent.click(screen.getByRole("button", { name: "Current search" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Watchlist name" }), {
      target: { value: "Selected audience test" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /Some groups and roles/ }));
    expect(screen.getAllByText("System watchlist")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Save new watchlist" })).toBeDisabled();
    fireEvent.click(await screen.findByRole("checkbox", { name: /Reading Room/ }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "reader" }));
    fireEvent.click(screen.getByRole("button", { name: "Save new watchlist" }));

    await waitFor(async () => {
      const created = (await listWatchlists("documents")).find(
        (row) => row.name === "Selected audience test",
      );
      expect(created?.audience).toEqual({ kind: "some", groupIds: ["g3"], roleIds: ["reader"] });
    });
    const created = (await listWatchlists("documents")).find(
      (row) => row.name === "Selected audience test",
    );
    if (created) await deleteWatchlist(created.id);
  });

  it("edits and deletes a saved tab in its popover", async () => {
    server.use(...createHandlers("admin"));
    const created = await createWatchlist({
      names: { cs: "Test překryvu", en: "Overlay test" },
      view: "documents",
      filter: { q: "overlay-test" },
      audience: { kind: "personal" },
    });
    try {
      render(
        <WatchlistTabs
          view="documents"
          filter={{ q: "overlay-test" }}
          openedId={created.id}
          canShare
          onOpen={vi.fn()}
          onDetach={vi.fn()}
          isBare={false}
        />,
        { wrapper: Providers },
      );
      fireEvent.click(await screen.findByRole("button", { name: "Overlay test options" }));
      expect(screen.getByRole("textbox", { name: "Watchlist name" })).toHaveValue("Overlay test");
      expect(screen.getByRole("radio", { name: "Only me" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete watchlist" })).toBeInTheDocument();
      expect(screen.queryByRole("menu")).toBeNull();
      fireEvent.change(screen.getByRole("textbox", { name: "Watchlist name" }), {
        target: { value: "Edited in overlay" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save watchlist" }));
      await waitFor(async () =>
        expect(
          (await listWatchlists("documents")).find((row) => row.id === created.id),
        ).toMatchObject({
          name: "Edited in overlay",
          names: { cs: "Test překryvu", en: "Edited in overlay" },
        }),
      );
      fireEvent.click(await screen.findByRole("button", { name: "Edited in overlay options" }));
      fireEvent.click(screen.getByRole("button", { name: "Delete watchlist" }));
      fireEvent.click(screen.getByRole("button", { name: "Delete watchlist" }));
      await waitFor(async () =>
        expect((await listWatchlists("documents")).some((row) => row.id === created.id)).toBe(
          false,
        ),
      );
    } finally {
      if ((await listWatchlists("documents")).some((row) => row.id === created.id)) {
        await deleteWatchlist(created.id);
      }
    }
  });

  it("lets a viewer save a personal copy from a system tab", async () => {
    server.use(...createHandlers("curator"));
    const source = (await listWatchlists("projects")).find((row) => row.id === "W-shared-9");
    if (!source) throw new Error("Expected the Proposed system watchlist");
    const onOpen = vi.fn();
    render(
      <WatchlistTabs
        view="projects"
        filter={source.filter}
        openedId={source.id}
        canShare={false}
        onOpen={onOpen}
        onDetach={vi.fn()}
        isBare={false}
      />,
      { wrapper: Providers },
    );
    fireEvent.click(await screen.findByRole("button", { name: "Proposed options" }));
    expect(screen.queryByRole("button", { name: "Save watchlist" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete watchlist" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Watchlist name" }), {
      target: { value: "My proposed projects" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save a personal copy" }));
    await waitFor(() =>
      expect(onOpen).toHaveBeenCalledWith(
        expect.objectContaining({ name: "My proposed projects", audience: { kind: "personal" } }),
      ),
    );
    const copy = (await listWatchlists("projects")).find(
      (row) => row.name === "My proposed projects",
    );
    expect(copy?.filter).toEqual(source.filter);
    expect((await listWatchlists("projects")).some((row) => row.id === source.id)).toBe(true);
    if (copy) await deleteWatchlist(copy.id);
  });

  it("keeps a new-entry badge briefly after opening while marking entries seen immediately", async () => {
    server.use(...createHandlers("admin"));
    const running = (await listWatchlists("tasks")).find((row) => row.name === "Running");
    if (!running) return;
    const userId = resolveSession("admin").user.id;
    const entry = database.watchlistEntries.find(
      (row) => row.userId === userId && row.watchlistId === running.id,
    );
    const viewer = database.watchlistViewers.find(
      (row) => row.userId === userId && row.watchlistId === running.id,
    );
    expect(entry).toBeDefined();
    expect(viewer).toBeDefined();
    if (!entry || !viewer) return;
    const previousEntry = { ...entry };
    const previousSeenAt = viewer.seenAt;
    entry.baseline = false;
    entry.enteredAt = new Date().toISOString();
    viewer.seenAt = null;

    try {
      const newCount = (await listWatchlists("tasks")).find(
        (row) => row.id === running.id,
      )?.newCount;
      expect(newCount).toBeGreaterThan(0);
      render(
        <WatchlistTabs
          view="tasks"
          filter={{}}
          openedId={null}
          canShare
          onOpen={vi.fn()}
          onDetach={vi.fn()}
          isBare={false}
        />,
        { wrapper: Providers },
      );

      const tab = await screen.findByRole("button", { name: /Running/ });
      fireEvent.click(tab);
      await waitFor(async () => {
        expect((await listWatchlists("tasks")).find((row) => row.id === running.id)?.newCount).toBe(
          0,
        );
      });
      expect(tab).toHaveTextContent(`+${newCount}`);
      await waitFor(() => expect(tab).not.toHaveTextContent(`+${newCount}`), {
        timeout: 3_500,
      });
    } finally {
      Object.assign(entry, previousEntry);
      viewer.seenAt = previousSeenAt;
    }
  });
});
