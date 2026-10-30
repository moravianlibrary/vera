import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ProposeDialog } from "@/features/documents/propose-dialog";
import { createHandlers } from "@/mocks/handlers";
import { resolveSession } from "@/mocks/session";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function openPropose() {
  server.use(...createHandlers("reader"));
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
        ask={{
          record: "MZK03-000778120",
          identifier: null,
          unit: null,
          reason: null,
          sourceId: "pi43",
          returnTo: "https://www.mzk.cz/catalog",
        }}
      />
    </QueryClientProvider>,
  );
}

describe("ProposeDialog", () => {
  it("asks before closing with an item and keeps it when editing continues", async () => {
    openPropose();
    expect(await screen.findByText("1 item")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(await screen.findByText("1 item")).toBeInTheDocument();
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
