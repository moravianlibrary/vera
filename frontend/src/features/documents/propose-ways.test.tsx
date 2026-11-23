// The camera way where the browser cannot read barcodes from the camera, as jsdom cannot: each
// book is photographed and its code read by the barcode plugin on the server, then added like a
// scan (ACT-ways-in).

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { apiRoutes } from "@vera/contract/routes";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { BarcodeWay, PhotoWay } from "@/features/documents/propose-ways";
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

// ACT-ways-in: with several photo readers the person picks one; the first reads until they do.
describe("the photo way", () => {
  const readers = [
    { id: "pi13", name: "OCR pilot" },
    { id: "pi99", name: "Covers" },
  ];

  it("offers the readers when there are several, and reads by the first", async () => {
    const asked: (string | null)[] = [];
    server.use(
      http.post(`*/api${apiRoutes.proposalPhoto}`, async ({ request }) => {
        asked.push((await request.formData()).get("reader") as string | null);
        return HttpResponse.json({
          seen: "a cover",
          read: [],
          hasIdentifiers: false,
          candidates: [],
        });
      }),
      ...createHandlers("reader"),
    );
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <PhotoWay readers={readers} onAdd={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("combobox", { name: "Read by" })).toHaveTextContent("OCR pilot");
    const photo = container.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(photo as HTMLInputElement, {
      target: { files: [new File(["jpeg"], "cover.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(asked).toEqual(["pi13"]));
  });

  it("offers no choice with one reader", () => {
    server.use(...createHandlers("reader"));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PhotoWay readers={readers.slice(0, 1)} onAdd={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.queryByRole("combobox", { name: "Read by" })).toBeNull();
  });
});
