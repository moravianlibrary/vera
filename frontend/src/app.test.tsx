import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { router } from "@/app";

vi.mock("@/features/system/signed-out-page", () => ({
  SignedOutPage: () => {
    throw new Error("signed out render failure");
  },
}));

describe("route crash boundaries", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders CrashPage when /signed-out throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <RouterProvider
        router={createMemoryRouter(router.routes, { initialEntries: ["/signed-out"] })}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument();
  });
});
