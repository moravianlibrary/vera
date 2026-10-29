// The contract check, on endpoints made up for the test.

import { describe, expect, it } from "bun:test";
import { problemSchema } from "@vera/contract/problem";
import { z } from "zod";
import { testEngine } from "../../test/engine";
import { serveApi } from "./api";
import { endpoint } from "./endpoint";
import { matchPath } from "./match";

const engine = testEngine();
const noCaller = () => ({ caller: null, cookie: null });

const endpoints = [
  endpoint({
    method: "GET",
    path: "/things/:thingId",
    params: z.object({ thingId: z.string().regex(/^t\d+$/) }),
    query: z.object({ limit: z.coerce.number().int().positive().optional() }),
    response: z.object({ id: z.string(), limit: z.number().nullable() }),
    handle: ({ params, query }) => ({ body: { id: params.thingId, limit: query.limit ?? null } }),
  }),
  endpoint({
    method: "POST",
    path: "/things",
    body: z.object({ name: z.string().min(1) }),
    response: z.object({ id: z.string(), name: z.string() }),
    handle: ({ body }) => ({ status: 201, body: { id: "t1", name: body.name } }),
  }),
  endpoint({
    method: "GET",
    path: "/broken",
    response: z.object({ count: z.number() }),
    handle: () => ({ body: { count: "many" } as unknown as { count: number } }),
  }),
  endpoint({
    method: "DELETE",
    path: "/things/:thingId",
    handle: () => ({ body: undefined }),
  }),
];

function serve(method: string, path: string, body?: string) {
  return serveApi(
    new Request(`http://engine.test/api${path}`, { method, body }),
    endpoints,
    engine,
    noCaller,
  );
}

async function problemOf(response: Response) {
  return problemSchema.parse(await response.json());
}

describe("matching a path", () => {
  it("takes one whole segment for each name, decoded", () => {
    expect(matchPath("/documents/:id", "/documents/D%201")).toEqual({ id: "D 1" });
    expect(matchPath("/documents/:id", "/documents/")).toBeNull();
    expect(matchPath("/documents/:id", "/documents/a/b")).toBeNull();
    expect(matchPath("/session", "/session")).toEqual({});
  });
});

describe("the contract check", () => {
  it("hands the handler parsed input and sends an answer that fits", async () => {
    const response = await serve("GET", "/things/t7?limit=5");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "t7", limit: 5 });
  });

  it("answers with the endpoint's status", async () => {
    const response = await serve("POST", "/things", JSON.stringify({ name: "Atlas" }));
    expect(response.status).toBe(201);
  });

  it("refuses input that does not fit, naming the fields (ACT-refusal)", async () => {
    const response = await serve("POST", "/things", JSON.stringify({ name: "" }));
    expect(response.status).toBe(422);
    const body = await problemOf(response);
    expect(body.code).toBe("invalid");
    expect(body.errors?.map(({ field }) => field)).toEqual(["name"]);
    expect((await serve("GET", "/things/x7")).status).toBe(422);
    expect((await serve("GET", "/things/t7?limit=-1")).status).toBe(422);
  });

  it("refuses a body that is not JSON", async () => {
    const response = await serve("POST", "/things", "{not json");
    expect(response.status).toBe(400);
    expect((await problemOf(response)).code).toBe("bad_request");
  });

  it("answers 500 when the answer does not fit the contract", async () => {
    const response = await serve("GET", "/broken");
    expect(response.status).toBe(500);
    expect((await problemOf(response)).code).toBe("contract.response");
  });

  it("answers 204 with no body where the endpoint has no response", async () => {
    const response = await serve("DELETE", "/things/t1");
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("tells an unknown path from a method the path does not take", async () => {
    expect((await serve("GET", "/nothing")).status).toBe(404);
    expect((await serve("PUT", "/things")).status).toBe(405);
  });
});
