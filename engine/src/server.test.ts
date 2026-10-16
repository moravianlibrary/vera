// The engine behind a real port, as the frontend's proxy reaches it.

import { afterAll, describe, expect, it } from "bun:test";
import { testEngine } from "../test/engine";
import { devPersonHeader } from "./access/caller";

const engine = testEngine();
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: engine.fetch });

afterAll(() => {
  server.stop(true);
});

describe("the server", () => {
  it("answers over HTTP", async () => {
    const response = await fetch(new URL("/api/session", server.url), {
      headers: { [devPersonHeader]: "reader" },
    });
    expect(response.status).toBe(200);
    const session = (await response.json()) as { user: { id: string } };
    expect(session.user.id).toBe("u2");
  });

  it("answers Problem Details for what it does not serve", async () => {
    const response = await fetch(new URL("/elsewhere", server.url));
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
  });
});
