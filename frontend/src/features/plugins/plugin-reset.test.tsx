// Reset goes through the same mock endpoint as a drawer action, then returns its page notice.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { I18nextProvider } from "react-i18next";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { PluginDialogView } from "@/features/plugins/plugin-acts";
import { i18n } from "@/i18n";
import { createHandlers } from "@/mocks/handlers";
import { pluginIndex } from "@/mocks/plugins";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it("confirms reset through the mock endpoint and reports the instance notice", async () => {
  server.use(...createHandlers("admin"));
  const index = pluginIndex();
  const instance = index.instances.find(({ canReset }) => canReset);
  if (instance === undefined) throw new Error("Missing resettable plugin fixture");
  const onDone = vi.fn();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <I18nextProvider i18n={i18n}>
        <PluginDialogView
          dialog={{ kind: "reset", instanceId: instance.id }}
          index={index}
          onClose={() => {}}
          onDone={onDone}
        />
      </I18nextProvider>
    </QueryClientProvider>,
  );

  expect(
    screen.getByText(
      instance.mirror === null
        ? "Its cursors are cleared, so the next run reads from the start."
        : "Its cursors are cleared, so the next run reads the catalog from the start and rebuilds the mirror. Nothing in VERA's documents changes.",
    ),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  await waitFor(() =>
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ text: `${instance.name} was reset.`, tone: "green" }),
      { instanceId: instance.id },
    ),
  );
});
