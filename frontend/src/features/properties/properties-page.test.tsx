// The Properties page lists every definition and keeps the predefined four (DOC-property,
// DOC-property-predefined); the record pane shows a property with its sources and enters it by
// hand (DOC-property-values, DOC-property-hand).

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { setupServer } from "msw/node";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PropertiesCard } from "@/features/properties/properties-card";
import { PropertiesPage } from "@/features/properties/properties-page";
import { database } from "@/mocks/database";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  window.matchMedia = (query) => ({
    matches: true,
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

function wrap(children: React.ReactNode, url = "/properties") {
  server.use(...createHandlers("admin"));
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="*" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Properties page", () => {
  it("lists the definitions and offers no delete for a predefined one", async () => {
    wrap(<PropertiesPage />, "/properties?property=title");
    expect((await screen.findAllByText("Machines")).length).toBeGreaterThan(0);
    expect(await screen.findByText(/edited but never deleted/)).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete…" })).not.toBeInTheDocument();
  });
});

describe("Properties on the record pane", () => {
  it("shows a value with its source and enters a new one by hand", async () => {
    const document = database.documents.find((candidate) => candidate.id === "D5");
    const iterations = database.iterations.filter((iteration) => iteration.documentId === "D5");
    if (document === undefined) throw new Error("D5 is missing");
    wrap(
      <PropertiesCard
        record={{ document, iterations, requests: [] }}
        audience="staff"
        nameOf={(id) => id}
      />,
      "/documents",
    );
    expect(await screen.findAllByText("Bookeye, Zeutschel")).toHaveLength(2);
    expect(screen.getByText(/By hand · tier 100/)).toBeInTheDocument();
    const changes = screen.getAllByRole("button", { name: "Change…" });
    fireEvent.click(changes.at(-1) as HTMLElement);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Treventus" }));
    fireEvent.click(screen.getByRole("button", { name: "Enter" }));
    expect(await screen.findByText("Machines entered.")).toBeInTheDocument();
    expect(
      database.iterations.find((iteration) => iteration.id === "IT5")?.properties[0]?.sources[0]
        ?.value,
    ).toEqual(["bookeye", "zeutschel", "treventus"]);
  });
});
