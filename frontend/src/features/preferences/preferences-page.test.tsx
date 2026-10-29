import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { setupServer } from "msw/node";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PreferencesPage } from "@/features/preferences/preferences-page";
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

function open(section: string) {
  server.use(...createHandlers("admin"));
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[`/preferences/${section}`]}>
        <Routes>
          <Route path="/preferences/:section" element={<PreferencesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Preferences", () => {
  it("offers the four addressable sections and language under Display", async () => {
    open("display");
    for (const section of ["watchlists", "notifications", "display", "account"]) {
      expect(screen.getByRole("link", { name: section })).toHaveAttribute(
        "href",
        `/preferences/${section}`,
      );
    }
    expect(await screen.findByText("Language")).toBeInTheDocument();
  });

  it("shows the signed-in person's account details", async () => {
    open("account");
    expect(await screen.findByText("Sign-in identities")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "What you can do" })).toBeInTheDocument();
  });
});
