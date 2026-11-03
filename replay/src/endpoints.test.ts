import { expect, it } from "bun:test";
import { endpoints } from "@vera/contract/endpoints";
import { endpointOf } from "./endpoints";

it("matches recorded calls to API endpoints", () => {
  const properties = endpointOf({ method: "GET", path: "/api/properties" });
  expect(properties).toBe("properties");
  expect(properties && endpoints[properties].engine).toBe(false);
  expect(endpointOf({ method: "GET", path: "/api/requests/D1" })).toBe("requestDetail");
});
