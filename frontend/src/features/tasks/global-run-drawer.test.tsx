import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { MemoryRouter, useLocation } from "react-router";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { RunningTasksPanel } from "@/components/layout/running-tasks-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GlobalRunDrawer } from "@/features/tasks/global-run-drawer";
import { createHandlers } from "@/mocks/handlers";
import { resolveSession } from "@/mocks/session";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function LocationLine() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

describe("UI-running", () => {
  it("opens a run over the current page and closes without leaving it", async () => {
    server.use(...createHandlers("curator"));
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <TooltipProvider>
          <MemoryRouter initialEntries={["/projects?state=Active"]}>
            <h1>Projects</h1>
            <RunningTasksPanel session={resolveSession("curator")} isShowingLabels />
            <GlobalRunDrawer />
            <LocationLine />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByTitle("Re-check — 12 documents in Periodicals"));
    expect(screen.getByTestId("location")).toHaveTextContent("/projects?state=Active&run=T-9915");
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent("T-9915"));
    expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/projects?state=Active"),
    );
    expect(screen.getByTestId("location")).not.toHaveTextContent("run=");
  });
});
