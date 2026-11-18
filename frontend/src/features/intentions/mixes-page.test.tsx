import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { MixesPage } from "@/features/intentions/mixes-page";
import { i18n } from "@/i18n";
import { database } from "@/mocks/database";
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

it("creates a mix named only in the other language", async () => {
  server.use(...createHandlers("admin"));
  const original = structuredClone(database.distributions);
  await i18n.changeLanguage("en");
  try {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={["/mixes"]}>
            <Routes>
              <Route path="/mixes" element={<MixesPage />} />
              <Route path="/mixes/:mixId" element={<MixesPage />} />
            </Routes>
          </MemoryRouter>
        </I18nextProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "New mix" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Czech name" }));
    fireEvent.change(screen.getByLabelText("Name in Czech"), { target: { value: "Nový mix" } });
    fireEvent.click(screen.getByRole("button", { name: "Create mix" }));

    await waitFor(() => {
      expect(database.distributions.find(({ names }) => names.cs === "Nový mix")?.names).toEqual({
        cs: "Nový mix",
      });
    });
  } finally {
    database.distributions.splice(0, database.distributions.length, ...original);
    await i18n.changeLanguage("en");
  }
});
