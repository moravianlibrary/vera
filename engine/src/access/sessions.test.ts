// Sessions carried by the vera_session cookie.

import { describe, expect, it } from "bun:test";
import { call, sessionCookieOf, testEngine } from "../../test/engine";
import { hashOf, openSession } from "./sessions";

describe("sessions", () => {
  it("opens a cookie session for a user", async () => {
    const engine = testEngine();
    const opened = await call(engine, "POST", "/_engine/sessions", { body: { userId: "u1" } });
    const token = sessionCookieOf(opened);
    expect(opened.status).toBe(200);
    expect(await opened.json()).toEqual({ userId: "u1" });
    expect(token).not.toBeNull();
    const cookie = opened.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=1800");
    expect(cookie).not.toContain("Secure");
    const response = await engine.fetch(
      new Request("http://engine.test/api/session", {
        headers: { Cookie: `vera_session=${token}` },
      }),
    );
    expect(((await response.json()) as { user: { id: string } }).user.id).toBe("u1");
    engine.close();
  });

  it("reissues the same cookie on every signed-in answer and moves seen_at", async () => {
    const engine = testEngine();
    const token = openSession(engine, "u1", null);
    engine.clock.advance(60_000);
    const response = await engine.fetch(
      new Request("http://engine.test/api/session", {
        headers: { Cookie: `vera_session=${token}` },
      }),
    );
    expect(sessionCookieOf(response)).toBe(token);
    expect(
      engine.db
        .query<{ seen_at: string }, [string]>("SELECT seen_at FROM sessions WHERE token_hash = ?")
        .get(hashOf(token))?.seen_at,
    ).toBe(engine.clock.now().toISOString());
    engine.close();
  });

  it("expires after the idle limit and clears the cookie", async () => {
    const engine = testEngine();
    const token = openSession(engine, "u1", null);
    engine.clock.advance(31 * 60 * 1000);
    const response = await engine.fetch(
      new Request("http://engine.test/api/session", {
        headers: { Cookie: `vera_session=${token}` },
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(engine.db.query("SELECT token_hash FROM sessions").all()).toHaveLength(0);
    engine.close();
  });

  it("expires at the absolute limit despite regular requests", async () => {
    const engine = testEngine();
    const token = openSession(engine, "u1", null);
    for (let elapsed = 25 * 60 * 1000; elapsed < 12 * 60 * 60 * 1000; elapsed += 25 * 60 * 1000) {
      engine.clock.advance(25 * 60 * 1000);
      const response = await engine.fetch(
        new Request("http://engine.test/api/session", {
          headers: { Cookie: `vera_session=${token}` },
        }),
      );
      expect(response.status).toBe(200);
    }
    engine.clock.advance(25 * 60 * 1000);
    const expired = await engine.fetch(
      new Request("http://engine.test/api/session", {
        headers: { Cookie: `vera_session=${token}` },
      }),
    );
    expect(expired.status).toBe(401);
    engine.close();
  });

  it("logs out and clears the cookie, including when already signed out", async () => {
    const engine = testEngine();
    const token = openSession(engine, "u1", null);
    const loggedOut = await engine.fetch(
      new Request("http://engine.test/api/session/logout", {
        method: "DELETE",
        headers: { Cookie: `vera_session=${token}` },
      }),
    );
    expect(loggedOut.status).toBe(204);
    expect(loggedOut.headers.get("Set-Cookie")).toContain("Max-Age=0");
    const old = await engine.fetch(
      new Request("http://engine.test/api/session", {
        headers: { Cookie: `vera_session=${token}` },
      }),
    );
    expect(old.status).toBe(401);
    expect((await call(engine, "DELETE", "/api/session/logout")).status).toBe(204);
    engine.close();
  });

  it("refuses unknown and suspended users", async () => {
    const engine = testEngine();
    expect(
      (await call(engine, "POST", "/_engine/sessions", { body: { userId: "u99" } })).status,
    ).toBe(404);
    const suspended = await call(engine, "POST", "/_engine/sessions", { body: { userId: "u3" } });
    expect(suspended.status).toBe(403);
    expect(((await suspended.json()) as { code: string }).code).toBe("access.suspended");
    engine.close();
  });

  it("refuses an agent", async () => {
    const engine = testEngine("base");
    expect(
      (await call(engine, "POST", "/_engine/sessions", { body: { userId: "a1" } })).status,
    ).toBe(422);
    engine.close();
  });

  it("stores only the token hash", () => {
    const engine = testEngine();
    const token = openSession(engine, "u1", null);
    const stored = engine.db
      .query<{ token_hash: string }, []>("SELECT token_hash FROM sessions")
      .get()?.token_hash;
    expect(stored).toBe(hashOf(token));
    expect(stored).not.toBe(token);
    engine.close();
  });
});
