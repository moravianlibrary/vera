import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { useSectionPreferences } from "@/hooks/use-section-preferences";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPreferences(board: "projects" | "intentions") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSectionPreferences(board), { wrapper });
}

describe("useSectionPreferences", () => {
  it("starts open, shows a toggle at once and restores it from the server", async () => {
    server.use(...createHandlers("reader"));
    const first = renderPreferences("projects");
    expect(first.result.current.isOpen("rejected")).toBe(true);

    act(() => first.result.current.setOpen("rejected", false));
    expect(first.result.current.isOpen("rejected")).toBe(false);
    await waitFor(() => expect(first.result.current.isOpen("rejected")).toBe(false));
    first.unmount();

    const restored = renderPreferences("projects");
    await waitFor(() => expect(restored.result.current.isOpen("rejected")).toBe(false));
    expect(restored.result.current.isOpen("ended")).toBe(true);
    restored.unmount();
  });

  it("leaves the other board untouched", async () => {
    server.use(...createHandlers("reader"));
    const first = renderPreferences("projects");
    act(() => first.result.current.setOpen("rejected", false));
    await waitFor(() => expect(first.result.current.isOpen("rejected")).toBe(false));
    first.unmount();

    const intentions = renderPreferences("intentions");
    await waitFor(() => expect(intentions.result.current.isOpen("archived")).toBe(true));
    expect(intentions.result.current.isOpen("repeats")).toBe(true);
  });
});
