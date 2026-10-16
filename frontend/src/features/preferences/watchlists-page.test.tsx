import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { setupServer } from "msw/node";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { WatchlistsPage } from "@/features/preferences/watchlists-page";
import { createHandlers } from "@/mocks/handlers";

// Reconciling every watchlist is slow under the full suite's load; the default 5 s is not enough.
vi.setConfig({ testTimeout: 20_000 });

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function open(profile: "admin" | "reader", url = "/watchlists") {
  server.use(...createHandlers(profile));
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/watchlists" element={<WatchlistsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Watchlists page", () => {
  it("links a personal watchlist to its saved filter", async () => {
    open("reader");
    const link = await screen.findByRole("link", { name: "Ready to read" });
    expect(link).toHaveAttribute("href", expect.stringContaining("/my-documents?"));
    expect(link).toHaveAttribute("href", expect.stringContaining("status=Available"));
  });

  it("groups personal and system watchlists in one table per view", async () => {
    open("admin");
    const periodicals = await screen.findByRole("link", { name: "Periodicals" });
    expect(periodicals).toHaveAttribute("href", expect.stringContaining("/requests?"));
    expect(screen.getByRole("button", { name: "Audience for Periodicals" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "System watchlists" })).not.toBeInTheDocument();
    const documentsHeading = screen.getByRole("heading", { name: "Documents" });
    const documentsTable = within(documentsHeading.parentElement as HTMLElement).getByRole("table");
    expect(
      within(documentsTable).getByRole("link", { name: "Urgent, no copy" }),
    ).toBeInTheDocument();
    expect(within(documentsTable).getByRole("link", { name: "Forbidden" })).toBeInTheDocument();
    expect(within(documentsTable).getAllByText("System").length).toBeGreaterThan(0);
  });
});
