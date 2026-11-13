import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { I18nextProvider } from "react-i18next";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { CategoryFormDialog } from "@/features/categories/category-dialogs";
import { i18n } from "@/i18n";
import { database } from "@/mocks/database";
import { categories } from "@/mocks/fixtures/categories";
import { createHandlers } from "@/mocks/handlers";
import { resolveSession } from "@/mocks/session";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it("sends the edited language and keeps the other loaded category name", async () => {
  server.use(...createHandlers("admin"));
  await i18n.changeLanguage("cs");
  try {
    const category = categories.find(({ id }) => id === "c1");
    if (category === undefined) throw new Error("Missing category fixture");
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <I18nextProvider i18n={i18n}>
          <CategoryFormDialog
            isOpen
            onClose={() => {}}
            categories={categories}
            category={category}
            parentId={null}
            holdsDocuments={() => false}
            session={resolveSession("admin")}
            onSaved={() => {}}
          />
        </I18nextProvider>
      </QueryClientProvider>,
    );

    const field = screen.getByLabelText("Název");
    await act(async () => {
      fireEvent.change(field, { target: { value: "Nové monografie" } });
      fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
      await waitFor(() => {
        expect(database.categories.find(({ id }) => id === "c1")?.names).toEqual({
          en: "Monographs",
          cs: "Nové monografie",
        });
      });
    });
  } finally {
    await i18n.changeLanguage("en");
  }
});
