import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ApiError } from "@/api/http";
import { getSession, logout } from "@/api/session";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  window.sessionStorage.clear();
});
afterAll(() => server.close());

describe("mock session", () => {
  it("ends the current session until a new mock sign-in", async () => {
    server.use(...createHandlers("reader"));
    expect((await getSession()).user.id).toBe("u5");
    await logout();
    await expect(getSession()).rejects.toMatchObject({ status: 401 } satisfies Partial<ApiError>);
    window.sessionStorage.removeItem("vera.mock.signed-out.reader");
    expect((await getSession()).user.id).toBe("u5");
  });
});
