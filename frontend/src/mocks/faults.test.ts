import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ApiError } from "@/api/http";
import { listLoginEntries } from "@/api/login";
import { listMixes } from "@/api/mix-catalog";
import { getSession } from "@/api/session";
import { faultHandlers } from "@/mocks/faults";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  window.sessionStorage.clear();
});
afterAll(() => server.close());

describe("mock faults", () => {
  it("makes the whole mock unavailable", async () => {
    server.use(...faultHandlers("unavailable"), ...createHandlers("reader"));
    await expect(getSession()).rejects.toMatchObject({ status: 503 } satisfies Partial<ApiError>);
  });

  it("keeps session and login available while data fails", async () => {
    server.use(...faultHandlers("data"), ...createHandlers("reader"));
    expect((await getSession()).user.id).toBe("u5");
    expect(await listLoginEntries()).toEqual(expect.any(Array));
    await expect(listMixes()).rejects.toMatchObject({ status: 503 } satisfies Partial<ApiError>);
  });

  it("has no handlers when no fault is selected", () => {
    expect(faultHandlers("none")).toEqual([]);
  });
});
