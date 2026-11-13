// HOOK-condition: the chosen events select the page filters kept in the draft.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { hasPermission } from "@vera/domain/permissions";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { HookEditor } from "@/features/hooks/hook-editor";
import { hooks } from "@/mocks/fixtures/hooks";
import { createHandlers } from "@/mocks/handlers";
import { resolveSession } from "@/mocks/session";

const server = setupServer(...createHandlers("admin"));
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => server.resetHandlers());
afterAll(() => {
  server.close();
  vi.unstubAllGlobals();
});

it("shows the Requests filter for request events and drops it for only list events", async () => {
  const hook = {
    ...hooks[0],
    events: ["request.created" as const],
    conditions: { requests: { decision: "Pending" } },
  };
  const onSave = vi.fn(async () => ({ isDone: true as const, value: hook }));
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <HookEditor
        hook={hook}
        channels={[{ id: hook.channelId, name: "Webhook", interface: "Webhook", isEnabled: true }]}
        onClose={vi.fn()}
        onSave={onSave}
        onSaved={vi.fn()}
      />
    </QueryClientProvider>,
  );
  expect(screen.getByRole("group", { name: "Requests" })).toBeInTheDocument();
  fireEvent.pointerDown(screen.getByRole("button", { name: "When" }), {
    button: 0,
    ctrlKey: false,
  });
  fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "list.created" }));
  fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "request.created" }));
  fireEvent.keyDown(screen.getByRole("menuitemcheckbox", { name: "list.created" }), {
    key: "Escape",
  });
  expect(screen.queryByRole("group", { name: "Requests" })).not.toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Lists" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save hook" }));
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onSave.mock.calls[0]).toBeDefined();
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ events: ["list.created"], conditions: {} }),
  );
});

it("offers unselected categories to a hook editor without system-watchlist permission", async () => {
  const admin = resolveSession("admin");
  const session = {
    ...admin,
    grants: admin.grants.filter(({ permission }) => permission !== "watchlist.manage_system"),
  };
  expect(hasPermission(session, "hook.configure")).toBe(true);
  expect(hasPermission(session, "watchlist.manage_system")).toBe(false);
  server.use(http.get("*/api/session", () => HttpResponse.json(session)));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <HookEditor
        hook={hooks[0]}
        channels={[
          { id: hooks[0].channelId, name: "Webhook", interface: "Webhook", isEnabled: true },
        ]}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onSaved={vi.fn()}
      />
    </QueryClientProvider>,
  );
  const category = await screen.findByRole("button", { name: "Category Periodicals" });
  fireEvent.pointerDown(category, { button: 0, ctrlKey: false });
  expect(
    await screen.findByRole("menuitemcheckbox", { name: /^Monographs(?:\s+0)?$/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("menuitemcheckbox", { name: /^Periodicals(?:\s+0)?$/ }),
  ).toBeInTheDocument();
});
