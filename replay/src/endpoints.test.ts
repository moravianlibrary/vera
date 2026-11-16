import { expect, it } from "bun:test";
import { endpoints } from "@vera/contract/endpoints";
import { endpointOf } from "./endpoints";
import { knownGapCall } from "./known-gaps";

it("matches recorded calls to API endpoints", () => {
  const properties = endpointOf({ method: "GET", path: "/api/properties" });
  expect(properties).toBe("properties");
  expect(properties && endpoints[properties].path).toBe("/properties");
  expect(endpointOf({ method: "GET", path: "/api/requests/D1" })).toBe("requestDetail");
});

it("matches known call gaps by the recorded method and path", () => {
  expect(
    knownGapCall("base-proposals.json", "b-admin-approve-now", {
      method: "GET",
      path: "/api/documents/$NEW_DOCUMENT",
    }),
  ).toEqual({ method: "GET", path: "/api/documents/$NEW_DOCUMENT" });
  expect(
    knownGapCall("base-proposals.json", "b-admin-approve-now", {
      method: "GET",
      path: "/api/login",
    }),
  ).toBeUndefined();
});
