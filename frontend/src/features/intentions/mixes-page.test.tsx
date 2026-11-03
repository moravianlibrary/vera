import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { setupServer } from "msw/node";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { MixesPage } from "@/features/intentions/mixes-page";
import { i18n } from "@/i18n";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("mix revision dates", () => {
  it("uses the shared long date format for a revision", async () => {
    server.use(...createHandlers("admin"));
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={["/mixes/d1"]}>
            <Routes>
              <Route path="/mixes/:mixId" element={<MixesPage />} />
            </Routes>
          </MemoryRouter>
        </I18nextProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("25 June 2026")).toBeInTheDocument();
  });
});
