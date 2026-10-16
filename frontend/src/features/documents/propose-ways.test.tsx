// The camera way where the browser cannot read barcodes from the camera, as jsdom cannot: each
// book is photographed and its code read by the barcode plugin on the server, then added like a
// scan (ACT-ways-in).

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { BarcodeWay } from "@/features/documents/propose-ways";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("the camera way without the browser's reader", () => {
  it("takes one photo per book and adds each code it reads", async () => {
    server.use(...createHandlers("reader"));
    const onAdd = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BarcodeWay canScanWithCamera onAdd={onAdd} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Use the camera/ }));
    const photo = await screen.findByLabelText("Photo of a barcode");
    fireEvent.change(photo, {
      target: { files: [new File(["jpeg"], "book.jpg", { type: "image/jpeg" })] },
    });

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(onAdd.mock.calls[0]?.[1]).toBe("barcode · camera");
    expect(screen.getByText("1")).toBeInTheDocument();

    fireEvent.change(photo, { target: { files: [new File([], "blank.jpg")] } });
    expect(await screen.findByText(/No barcode was read on that photo/)).toBeInTheDocument();
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
