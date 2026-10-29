import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ApiError } from "@/api/http";
import { listLoginEntries, loginWithForm } from "@/api/login";
import { disablePluginInstance } from "@/api/plugins";
import { getSession, logout } from "@/api/session";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  window.sessionStorage.clear();
});
afterAll(() => server.close());

describe("mock login", () => {
  it("lists enabled identity entries in order", async () => {
    server.use(...createHandlers("reader"));
    expect(await listLoginEntries()).toEqual([
      {
        instanceId: "pi22",
        label: "Log in with MZK account",
        entry: "redirect",
        canSignUp: false,
        canResetPassword: false,
      },
      {
        instanceId: "pi23",
        label: "Log in with eduID",
        entry: "redirect",
        canSignUp: false,
        canResetPassword: false,
      },
      {
        instanceId: "pi24",
        label: "Log in with a VERA account",
        entry: "form",
        canSignUp: true,
        canResetPassword: true,
      },
      {
        instanceId: "pi41",
        label: "Log in with Google",
        entry: "redirect",
        canSignUp: false,
        canResetPassword: false,
      },
      {
        instanceId: "pi42",
        label: "Log in with Seznam",
        entry: "redirect",
        canSignUp: false,
        canResetPassword: false,
      },
    ]);
  });

  it("signs a profile back in through its local form", async () => {
    server.use(...createHandlers("reader"));
    await logout();
    await expect(getSession()).rejects.toMatchObject({ status: 401 } satisfies Partial<ApiError>);
    await loginWithForm("pi24", { username: "reader", password: "x" });
    expect((await getSession()).user.id).toBe("u5");
  });

  it("does not accept a redirect identity as a form", async () => {
    server.use(...createHandlers("reader"));
    await expect(loginWithForm("pi22", { username: "a", password: "x" })).rejects.toMatchObject({
      status: 404,
    } satisfies Partial<ApiError>);
  });

  it("leaves a disabled identity off the login page", async () => {
    server.use(...createHandlers("admin"));
    await disablePluginInstance("pi23");
    expect(await listLoginEntries()).not.toContainEqual(
      expect.objectContaining({ instanceId: "pi23" }),
    );
  });
});
