import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { setupServer } from "msw/node";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { WatchlistsPage } from "@/features/preferences/watchlists-page";
import { createHandlers } from "@/mocks/handlers";

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
    expect(link).toHaveAttribute("href", expect.stringContaining("/documents?"));
    expect(link).toHaveAttribute("href", expect.stringContaining("status=Available"));
  });

  it("shows all system watchlists to a manager", async () => {
    open("admin", "/watchlists?section=system");
    expect(await screen.findByRole("heading", { name: "System watchlists" })).toBeInTheDocument();
    expect(await screen.findAllByText("Periodicals")).not.toHaveLength(0);
  });
});
