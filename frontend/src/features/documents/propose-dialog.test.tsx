import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ProposalSettings } from "@vera/contract/proposals";
import { apiRoutes } from "@vera/contract/routes";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ProposeDialog } from "@/features/documents/propose-dialog";
import { mockStore } from "@/mocks/database";
import { createHandlers } from "@/mocks/handlers";
import { mockProposalPlugins, proposalSettingsOf } from "@/mocks/proposals";
import { resolveSession } from "@/mocks/session";

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: vi.fn(),
    configurable: true,
  });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function openPropose(
  settingsOverride?: ProposalSettings,
  withAsk = true,
  lookupOverride?: unknown,
  rateLimitOverride?: number,
) {
  server.use(...createHandlers("reader"));
  if (settingsOverride !== undefined) {
    server.use(
      http.get(`*${apiRoutes.proposalSettings}`, () => HttpResponse.json(settingsOverride)),
    );
  }
  if (lookupOverride !== undefined) {
    server.use(http.post(`*${apiRoutes.proposalLookup}`, () => HttpResponse.json(lookupOverride)));
  }
  if (rateLimitOverride !== undefined) {
    server.use(
      http.get(`*${apiRoutes.proposalRateLimit}`, () =>
        HttpResponse.json({ perDay: rateLimitOverride }),
      ),
    );
  }
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProposeDialog
        isOpen
        onOpenChange={vi.fn()}
        session={resolveSession("reader")}
        viewTitle="Documents"
        ask={
          withAsk
            ? {
                record: "MZK03-000778120",
                identifier: null,
                unit: null,
                reason: null,
                sourceId: "pi43",
                returnTo: "https://www.mzk.cz/catalog",
              }
            : undefined
        }
      />
    </QueryClientProvider>,
  );
}

describe("ProposeDialog", () => {
  it("lets a reader name a batch of two items and sends that name", async () => {
    let submitted: { batchName: string | null } | undefined;
    openPropose(undefined, true, [
      {
        kind: "new",
        catalogId: "MZK03-000778120",
        unit: null,
        title: "First title",
        isAskedBefore: false,
        preview: { copies: [], restrictions: [] },
      },
    ]);
    server.use(
      http.post(`*${apiRoutes.proposals}`, async ({ request }) => {
        submitted = (await request.json()) as { batchName: string | null };
        return HttpResponse.json({ batch: null, proposed: 2, approved: 0, joined: 0, skipped: [] });
      }),
    );
    expect(
      resolveSession("reader").grants.some(({ permission }) => permission === "iteration.read"),
    ).toBe(false);

    await screen.findByText("1 item");
    fireEvent.click(await screen.findByRole("tab", { name: "Type it" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Identifier" }), {
      target: { value: "MZK03-000778121" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByText("2 items");
    const continueButton = screen.getByRole("button", { name: "Continue" });
    await waitFor(() => expect(continueButton).toBeEnabled());
    fireEvent.click(continueButton);
    const batchName = await screen.findByRole("textbox", { name: /Batch name/ });
    fireEvent.change(batchName, { target: { value: "Reader batch" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(submitted?.batchName).toBe("Reader batch"));
  });

  it("does not offer Submit and explains a zero daily limit", async () => {
    openPropose(undefined, true, undefined, 0);
    const pasteTab = await screen.findByRole("tab", { name: "Paste list" });
    fireEvent.focus(pasteTab);
    fireEvent.keyDown(pasteTab, { key: "Enter" });
    await screen.findByText("No more proposals today.");
    const continueButton = screen.getByRole("button", { name: "Continue" });
    await waitFor(() => expect(continueButton).toBeEnabled());
    fireEvent.click(continueButton);
    const submitButton = screen.getByRole("button", { name: "Submit" });
    await waitFor(() => expect(submitButton).toBeDisabled());
    expect(submitButton).toHaveAttribute("title", "Today’s proposal limit has been reached.");
  });

  it("words a daily-limit refusal by its code", async () => {
    openPropose();
    server.use(
      http.post(`*${apiRoutes.proposals}`, () =>
        HttpResponse.json(
          { status: 429, code: "proposal.daily_limit", detail: "limit reached" },
          { status: 429 },
        ),
      ),
    );
    const continueButton = await screen.findByRole("button", { name: "Continue" });
    await waitFor(() => expect(continueButton).toBeEnabled());
    fireEvent.click(continueButton);
    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Today’s proposal limit has been reached.")).toBeInTheDocument();
    expect(
      screen.queryByText("The proposal could not be submitted. Try again."),
    ).not.toBeInTheDocument();
  });

  it("asks which type when two Identifier instances recognise a pasted line", async () => {
    openPropose(
      {
        ...proposalSettingsOf(mockStore(), mockProposalPlugins, resolveSession("reader")),
        canDetectTypes: true,
        identifierTypes: [
          {
            type: "catalogId",
            labels: { en: "Catalog ID", cs: "Systémové číslo" },
            recogniser: { pattern: ".+", normalisation: [], checksum: null },
          },
          {
            type: "shelfMark",
            labels: { en: "Shelf mark", cs: "Signatura" },
            recogniser: { pattern: ".+", normalisation: [], checksum: null },
          },
        ],
      },
      false,
    );
    expect(await screen.findByRole("tab", { name: "Photo capture" })).toBeInTheDocument();
    const pasteTab = await screen.findByRole("tab", { name: "Paste list" });
    fireEvent.focus(pasteTab);
    fireEvent.keyDown(pasteTab, { key: "Enter" });
    const pastedItems = await screen.findByRole("textbox", { name: "Items, one per line" });
    fireEvent.change(pastedItems, { target: { value: "AMBIGUOUS-42" } });
    expect(pastedItems).toHaveValue("AMBIGUOUS-42");
    fireEvent.click(screen.getByRole("button", { name: "Add these" }));

    expect(await screen.findByText("Which type?")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("combobox", { name: "Identifier type" })[1] as HTMLElement);
    expect(await screen.findByRole("option", { name: "Catalog ID" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Shelf mark" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "ISBN" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Shelf mark" }));

    expect(await screen.findByText(/New|In VERA|Not in the catalog/)).toBeInTheDocument();
    expect(screen.queryByText("Which type?")).not.toBeInTheDocument();
  });

  it("asks before closing with an item and keeps it when editing continues", async () => {
    openPropose();
    expect(await screen.findByText("1 item")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(await screen.findByText("1 item")).toBeInTheDocument();
  });

  it("shows an available copy and staff restriction preview under the item", async () => {
    openPropose(undefined, true, [
      {
        kind: "new",
        catalogId: "MZK03-000778120",
        unit: null,
        title: "Preview title",
        isAskedBefore: false,
        preview: {
          copies: [{ source: "Kramerius", state: "Published", link: "https://example.test/read" }],
          restrictions: [{ forbidden: true, until: "2030-01-01", why: "Rights" }],
        },
      },
    ]);
    const link = await screen.findByRole("link", { name: "Kramerius" });
    expect(screen.getByText(/Already available/)).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://example.test/read");
    expect(screen.getByText("Forbidden until 2030-01-01 · Rights")).toBeInTheDocument();
  });

  it("says checks will run after submitting when a preview timed out", async () => {
    openPropose(undefined, true, [
      {
        kind: "new",
        catalogId: "MZK03-000778120",
        unit: null,
        title: "Preview title",
        isAskedBefore: false,
        preview: { copies: null, restrictions: null },
      },
    ]);
    expect(await screen.findByText("Checked after you submit")).toBeInTheDocument();
  });

  it("returns to the entry portal from the result screen", async () => {
    openPropose();
    const continueButton = await screen.findByRole("button", { name: "Continue" });
    await waitFor(() => expect(continueButton).toBeEnabled());
    fireEvent.click(continueButton);
    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));

    const back = await screen.findByRole("link", { name: "Back to Tlačítko digitalizovat" });
    expect(back).toHaveAttribute("href", "https://www.mzk.cz/catalog");
  });
});
