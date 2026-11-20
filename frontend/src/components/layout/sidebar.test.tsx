import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listWatchlists } from "@/api/watchlists";
import { Sidebar } from "@/components/layout/sidebar";
import { resolveSession } from "@/mocks/session";

vi.mock("@/api/watchlists", () => ({ listWatchlists: vi.fn() }));
vi.mock("@/hooks/use-appearance", () => ({
  useAppearance: () => ({ appearance: "system", setAppearance: vi.fn() }),
}));
vi.mock("@/components/layout/running-tasks-panel", () => ({
  RunningTasksPanel: () => null,
}));

describe("Sidebar watchlist counts", () => {
  beforeEach(() => {
    vi.mocked(listWatchlists).mockResolvedValue([{ view: "my-documents", newCount: 1 }] as Awaited<
      ReturnType<typeof listWatchlists>
    >);
  });

  it("shows a reader's new My Documents watchlist on that entry", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Sidebar session={resolveSession("reader")} isExpanded />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const myDocuments = await screen.findByRole("link", { name: /My Documents/ });
    expect(
      await screen.findByTitle(/watchlists with new items in My Documents/),
    ).toBeInTheDocument();
    expect(myDocuments).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Documents" })).not.toBeInTheDocument();
  });
});
