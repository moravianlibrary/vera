import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { findDocument } from "@/api/documents";
import { DocumentDetailPane } from "@/features/documents/document-detail";
import { createHandlers } from "@/mocks/handlers";
import { resolveSession } from "@/mocks/session";

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

describe("document detail publication links", () => {
  it("shows both fixture links with the primary first and marked", async () => {
    server.use(...createHandlers("curator"));
    const detail = await findDocument("D1");
    if (detail === null) throw new Error("D1 is in the fixtures");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DocumentDetailPane detail={detail} session={resolveSession("curator")} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const primary = await screen.findByRole("link", { name: "kramerius.mzk.cz/view/uuid:demo" });
    const other = await screen.findByRole("link", {
      name: "www.digitalniknihovna.cz/mzk/uuid/it1",
    });
    expect(screen.getByText("primary")).toBeInTheDocument();
    expect(primary.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
