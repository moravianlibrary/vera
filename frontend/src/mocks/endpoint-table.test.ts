import { endpoints } from "@vera/contract/endpoints";
import { describe, expect, it } from "vitest";
import { env } from "@/config/env";
import { handlers } from "@/mocks/handlers";

// The real API the backend serves; the mock fakes provider login.
const notInMock = ["GET /login/:instanceId", "GET /login/:instanceId/callback"];
// This handler is a mock stand-in for the real provider login flow.
const mockOnly = ["POST /login/:instanceId/mock", "POST /_engine/jobs/run"];

const keyOf = (method: string, path: string) => `${method.toUpperCase()} ${path}`;
const sameRoute = (first: string, second: string) => {
  const [firstMethod, ...firstPath] = first.split(" ");
  const [secondMethod, ...secondPath] = second.split(" ");
  return (
    firstMethod === secondMethod &&
    firstPath.length === secondPath.length &&
    firstPath.every(
      (part, index) =>
        part === secondPath[index] || (part.startsWith(":") && secondPath[index]?.startsWith(":")),
    )
  );
};

describe("mock handlers and the endpoint table", () => {
  it("covers the same API routes", () => {
    const apiBase = env.VITE_API_BASE_URL;
    const apiHandlers = handlers.flatMap((handler) => {
      const info = handler.info;
      const path =
        typeof info.path === "string" ? new URL(info.path, "http://localhost").pathname : "";
      if (!path.startsWith(`${apiBase}/`)) return [];
      const route = path.slice(apiBase.length);
      return route.startsWith("/_mock/") ? [] : [keyOf(String(info.method), route)];
    });
    const table = Object.values(endpoints).map((endpoint) => keyOf(endpoint.method, endpoint.path));
    const missingFromMock = table.filter(
      (entry) =>
        !notInMock.includes(entry) && !apiHandlers.some((handler) => sameRoute(handler, entry)),
    );
    const missingFromTable = apiHandlers.filter(
      (entry) => !table.some((endpoint) => sameRoute(endpoint, entry)) && !mockOnly.includes(entry),
    );
    expect(missingFromMock).toEqual([]);
    expect(missingFromTable).toEqual([]);
  });
});
