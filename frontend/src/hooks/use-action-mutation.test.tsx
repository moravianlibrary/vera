import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/http";
import { useActionMutation } from "@/hooks/use-action-mutation";

function renderMutation() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    () =>
      useActionMutation({
        call: async () => {
          throw new ApiError(409, "/test", "server failure", {
            type: "about:blank",
            status: 409,
            code: "future.untranslated",
            detail: "English detail that must stay private",
          });
        },
        invalidates: [],
      }),
    { wrapper },
  );
}

describe("useActionMutation", () => {
  it("uses the status words when a code has no words, never the server detail", async () => {
    const { result } = renderMutation();
    let outcome: Awaited<ReturnType<typeof result.current.run>> | undefined;
    await act(async () => {
      outcome = await result.current.run(undefined);
    });
    expect(outcome).toMatchObject({
      isDone: false,
      refusal: {
        status: 409,
        code: "future.untranslated",
        message: "Someone has changed it meanwhile.",
      },
    });
    expect(outcome?.isDone === false && outcome.refusal.message).not.toContain("English detail");
  });
});
