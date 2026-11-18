import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CustodyEditorDialog } from "@/features/access/access-dialogs";
import { RoleEditorDialog } from "@/features/access/role-dialogs";
import { i18n } from "@/i18n";
import { accessIndex } from "@/mocks/access";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderEditor(children: ReactNode) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>,
  );
}

describe("access names editors", () => {
  it("creates a role named only in the other language", async () => {
    i18n.changeLanguage("en");
    server.use(...createHandlers("admin"));
    const onSaved = vi.fn();
    renderEditor(
      <RoleEditorDialog
        isOpen
        onClose={vi.fn()}
        index={accessIndex()}
        source={{ kind: "new" }}
        onSaved={onSaved}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Czech name" }));
    fireEvent.change(screen.getByLabelText("Name in Czech"), { target: { value: "Kurátoři" } });
    fireEvent.click(screen.getByRole("button", { name: "Create role" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const saved = accessIndex().roles.find((role) => role.names.cs === "Kurátoři");
    expect(saved?.names).toEqual({ cs: "Kurátoři" });
  });

  it("creates a custody named only in the other language", async () => {
    i18n.changeLanguage("en");
    server.use(...createHandlers("admin"));
    const onSaved = vi.fn();
    renderEditor(<CustodyEditorDialog isOpen onClose={vi.fn()} custody={null} onSaved={onSaved} />);

    fireEvent.click(screen.getByRole("button", { name: "Add Czech name" }));
    fireEvent.change(screen.getByLabelText("Name in Czech"), {
      target: { value: "Unique FE2a custody" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create custody" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(
      accessIndex().custodies.some((custody) => custody.names.cs === "Unique FE2a custody"),
    ).toBe(true);
  });
});
