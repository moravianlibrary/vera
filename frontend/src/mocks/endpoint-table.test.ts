import { endpoints } from "@vera/contract/endpoints";
import { describe, expect, it } from "vitest";
import { env } from "@/config/env";
import { handlers } from "@/mocks/handlers";

// EP2 and EP3 empty this list; it must only shrink.
const notYetInTable = [
  "GET /hooks",
  "POST /hooks",
  "PUT /hooks/:id",
  "DELETE /hooks/:id",
  "POST /hooks/:id/pause",
  "POST /hooks/:id/resume",
  "POST /hooks/:id/retry",
  "POST /hooks/:id/send-now",
  "POST /hooks/deliveries/:id/retry",
  "POST /hooks/deliveries/:id/discard",
  "POST /hooks/preview",
  "POST /hooks/test",
  "GET /plugin-instances",
  "GET /tasks/running",
  "PUT /tasks/retention",
  "GET /tasks",
  "GET /tasks/:runId",
  "GET /tasks/:runId/log",
  "POST /tasks/:runId/cancel",
  "POST /tasks/:runId/rerun",
  "GET /schedules",
  "POST /schedules",
  "PUT /schedules/:scheduleId",
  "DELETE /schedules/:scheduleId",
  "POST /schedules/:id/pause",
  "POST /schedules/:scheduleId/resume",
  "POST /schedules/:scheduleId/run",
  "GET /plugins",
  "POST /plugin-instances",
  "PUT /plugin-instances/:id",
  "DELETE /plugin-instances/:id",
  "POST /plugin-instances/:id/enable",
  "POST /plugin-instances/:id/disable",
  "GET /plugin-instances/:id/impact",
  "POST /plugin-instances/:id/run",
  "GET /plugin-instances/:id/upgrade",
  "POST /plugin-instances/:id/upgrade",
  "POST /plugin-implementations/uploads",
  "POST /plugin-implementations/uploads/:id/install",
  "GET /categories",
  "GET /categories/overview",
  "POST /categories",
  "PUT /categories/:categoryId",
  "DELETE /categories/:categoryId",
  "GET /categories/:categoryId/impact",
  "PUT /categories/:categoryId/custody",
  "POST /categories/:id/refine",
  "GET /projects",
  "GET /intentions/overview",
  "GET /mixes",
  "GET /mixes/:mixId",
  "POST /mixes",
  "PUT /mixes/:mixId/sets",
  "POST /mixes/:mixId/snapshots",
  "POST /mixes/:mixId/primary",
  "POST /mixes/:mixId/archive",
  "DELETE /mixes/:mixId",
  "POST /intentions/preview",
  "POST /intentions",
  "PUT /intentions/:intentionId",
  "POST /intentions/:intentionId/archive",
  "POST /intentions/:intentionId/unarchive",
  "GET /intentions/:intentionId/correction",
  "GET /intentions/:intentionId/mix",
  "GET /intentions/:intentionId/deletion",
  "DELETE /intentions/:intentionId",
  "POST /intention-templates",
  "PUT /intention-templates/:templateId",
  "GET /projects/overview",
  "GET /projects/:projectId",
  "POST /projects",
  "POST /projects/:projectId/preview",
  "PUT /projects/:projectId",
  "PUT /projects/:projectId/members",
  "GET /projects/:projectId/decision",
  "POST /projects/:projectId/approve",
  "POST /projects/:projectId/reject",
  "DELETE /projects/:projectId",
  "GET /lists",
  "GET /digitization-lists",
  "GET /digitization-lists/pool",
  "GET /digitization-lists/generators",
  "POST /digitization-lists/generate",
  "GET /digitization-lists/shapes",
  "POST /digitization-lists/reading",
  "GET /digitization-lists/:listId",
  "POST /digitization-lists",
  "PUT /digitization-lists/:listId",
  "POST /digitization-lists/:listId/start",
  "GET /digitization-lists/:listId/done",
  "POST /digitization-lists/:listId/done",
  "GET /digitization-lists/:listId/deletion",
  "DELETE /digitization-lists/:listId",
  "POST /digitization-lists/:listId/items/:iterationId/not-digitizable",
  "GET /watchlists",
  "POST /watchlists",
  "POST /watchlists/reach",
  "PATCH /watchlists/:watchlistId",
  "PATCH /watchlists/:watchlistId/viewer",
  "POST /watchlists/:watchlistId/seen",
  "DELETE /watchlists/:watchlistId",
];
// The real API the engine serves; the mock fakes provider login.
const notInMock = ["GET /login/:instanceId", "GET /login/:instanceId/callback"];
// This handler is a mock stand-in for the real provider login flow.
const mockOnly = ["POST /login/:instanceId/mock"];

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
      (entry) =>
        !table.some((endpoint) => sameRoute(endpoint, entry)) &&
        !notYetInTable.includes(entry) &&
        !mockOnly.includes(entry),
    );
    expect(missingFromMock).toEqual([]);
    expect(missingFromTable).toEqual([]);
  });
});
