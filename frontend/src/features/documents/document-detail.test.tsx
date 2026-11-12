import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
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
  it("shows a defect by its plugin instance name and rule code", async () => {
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

    expect(await screen.findByText("Default ruleset R07")).toBeInTheDocument();
  });

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
    expect(await screen.findByText("Default ruleset R07")).toBeInTheDocument();
    expect(primary.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("document detail scoped links", () => {
  async function renderD1(session: ReturnType<typeof resolveSession>) {
    server.use(...createHandlers("admin"));
    const detail = await findDocument("D1");
    if (detail === null) throw new Error("D1 is in the fixtures");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DocumentDetailPane detail={detail} session={session} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("links a list in custody", async () => {
    const session = {
      ...resolveSession("curator"),
      grants: [{ permission: "list.read" as const, scope: "custody" as const }],
      custodyCategoryIds: ["c22"],
    };
    await renderD1(session);
    expect(await screen.findByRole("link", { name: "Moravica — June" })).toBeInTheDocument();
  });

  it("keeps a list name plain when its member is outside custody", async () => {
    const session = {
      ...resolveSession("curator"),
      grants: [{ permission: "list.read" as const, scope: "custody" as const }],
      custodyCategoryIds: ["c1"],
    };
    await renderD1(session);
    const name = await screen.findByText("Moravica — June");
    expect(name.closest("a")).toBeNull();
  });

  it("keeps a project name plain when project.read only reaches another project", async () => {
    const base = resolveSession("curator");
    const session = {
      ...base,
      user: { ...base.user, id: "outside" },
      groupIds: [],
      grants: [{ permission: "project.read" as const, scope: "project" as const }],
    };
    await renderD1(session);
    const name = await screen.findByText("NDK Periodika");
    expect(name.closest("a")).toBeNull();
  });
});

describe("catalog state in the document drawer", () => {
  it("shows the gone and replacement notices and opens the relink dialog for staff", async () => {
    server.use(...createHandlers("admin"));
    const gone = await findDocument("D35");
    const replacedDetail = await findDocument("D1");
    const replaced =
      replacedDetail === null
        ? null
        : {
            ...replacedDetail,
            record: {
              ...replacedDetail.record,
              document: {
                ...replacedDetail.record.document,
                catalogState: {
                  kind: "replaced" as const,
                  catalogId: "MZK01-001502234",
                  documentId: "D35",
                },
              },
            },
          };
    if (gone === null || replaced === null) throw new Error("Expected seeded documents");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DocumentDetailPane detail={gone} session={resolveSession("admin")} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/No longer in the catalog/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "MZK01-001502233" })).toHaveAttribute(
      "href",
      "https://vufind.mzk.cz/Record/MZK01-001502233",
    );
    fireEvent.click(screen.getByRole("button", { name: "Relink…" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Catalog ID")).toHaveValue("");

    unmount();
    const replacementClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={replacementClient}>
        <MemoryRouter>
          <DocumentDetailPane detail={replaced} session={resolveSession("admin")} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/Replaced in the catalog/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the document already in VERA" })).toHaveAttribute(
      "href",
      "/documents?id=D35",
    );
    fireEvent.click(screen.getByRole("button", { name: "Relink…" }));
    expect(screen.getByLabelText("Catalog ID")).toHaveValue("MZK01-001502234");
  });
});
