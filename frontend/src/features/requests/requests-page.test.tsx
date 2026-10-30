// A phone swipe on the Requests sheet follows the visible list and previews its neighbour.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { setupServer } from "msw/node";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RequestsPage } from "@/features/requests/requests-page";
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

function LocationLine() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

describe("Requests phone gestures", () => {
  it("swipes the open sheet to the next loaded row and peeks its title", async () => {
    server.use(...createHandlers("curator"));
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <TooltipProvider>
          <MemoryRouter initialEntries={["/requests"]}>
            <Routes>
              <Route
                path="*"
                element={
                  <>
                    <RequestsPage />
                    <LocationLine />
                  </>
                }
              />
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    const rows = await screen.findAllByRole("button", { name: /.+/ });
    const recordRows = rows.filter((row) => row.getAttribute("data-slot") === "record-list-row");
    expect(recordRows.length).toBeGreaterThan(1);
    const current = recordRows[0];
    const next = recordRows[1];
    const nextTitle = next.querySelector(".font-medium")?.textContent;
    expect(nextTitle).toBeTruthy();
    fireEvent.click(current);

    const dialog = await screen.findByRole("dialog");
    const body = dialog.querySelector(".touch-pan-y");
    expect(body).not.toBeNull();
    fireEvent.pointerDown(body as HTMLElement, {
      pointerType: "touch",
      clientX: 220,
      clientY: 300,
    });
    fireEvent.pointerMove(body as HTMLElement, { pointerType: "touch", clientX: 70, clientY: 300 });
    expect(within(dialog).getByText(`${nextTitle} ›`)).toBeInTheDocument();
    fireEvent.pointerUp(body as HTMLElement, { pointerType: "touch", clientX: 70, clientY: 300 });
    expect(next).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("location")).toHaveTextContent("id=");
  });
});
