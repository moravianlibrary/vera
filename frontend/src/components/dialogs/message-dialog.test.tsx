import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { setupServer } from "msw/node";
import { I18nextProvider } from "react-i18next";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { MessageDialog } from "@/components/dialogs/message-dialog";
import { i18n } from "@/i18n";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("MessageDialog sending instances", () => {
  async function renderDialog() {
    server.use(...createHandlers("admin"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <I18nextProvider i18n={i18n}>
          <MessageDialog
            isOpen
            onClose={() => {}}
            subject={{ kind: "proposal", id: "D20" }}
            label="Herbář"
            recipientLabel="the askers"
          />
        </I18nextProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByLabelText(/MZK Slack bot/));
  }

  it("asks for text and disables Send while empty", async () => {
    await renderDialog();
    const textarea = await screen.findByRole("textbox", { name: "Message" });
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();
    expect(send).toHaveAttribute("title", "Write the message first");
    expect(textarea).toBeRequired();
  });

  it("shows whom it reached after sending", async () => {
    await renderDialog();
    const textarea = await screen.findByRole("textbox", { name: "Message" });
    const send = screen.getByRole("button", { name: "Send" });
    fireEvent.change(textarea, { target: { value: "Please help" } });
    fireEvent.click(send);
    expect(await screen.findByText("Sent to Eva Horáková.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
