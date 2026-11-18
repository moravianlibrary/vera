// The instance editor sends the changed language while keeping the other name already loaded.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { pluginImplementationSchema } from "@vera/contract/plugins";
import { setupServer } from "msw/node";
import { I18nextProvider } from "react-i18next";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { InstanceEditorDialog } from "@/features/plugins/instance-editor";
import { i18n } from "@/i18n";
import { database } from "@/mocks/database";
import { pluginImplementations } from "@/mocks/fixtures/plugins";
import { createHandlers } from "@/mocks/handlers";
import { pluginIndex } from "@/mocks/plugins";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it("saves an instance named only in the other language", async () => {
  server.use(...createHandlers("admin"));
  const original = structuredClone(database.pluginInstances);
  await i18n.changeLanguage("cs");
  try {
    const instance = pluginIndex().instances.find(({ id }) => id === "pi1");
    const implementationSource = pluginImplementations.find(({ id }) => id === "pt1");
    const implementation =
      implementationSource === undefined
        ? undefined
        : pluginImplementationSchema.parse(implementationSource);
    if (instance === undefined || implementation === undefined)
      throw new Error("Missing Aleph instance fixture");
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <I18nextProvider i18n={i18n}>
          <InstanceEditorDialog
            onClose={() => {}}
            implementation={implementation}
            instance={instance}
            kindCount={3}
            onSaved={() => {}}
          />
        </I18nextProvider>
      </QueryClientProvider>,
    );

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Název"), { target: { value: "   " } });
      fireEvent.change(screen.getByLabelText("Název anglicky"), {
        target: { value: "New MZK Aleph" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
      await waitFor(() => {
        expect(database.pluginInstances.find(({ id }) => id === "pi1")?.names).toEqual({
          en: "New MZK Aleph",
        });
      });
    });
  } finally {
    database.pluginInstances.splice(0, database.pluginInstances.length, ...original);
    await i18n.changeLanguage("en");
  }
});
