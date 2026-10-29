// A test engine: in memory, development on, clock frozen at the seed's moment.

import type { Engine } from "../src/engine";
import { createEngine } from "../src/engine";

export function testEngine(seed = "minimal", development = true): Engine {
  return createEngine({ databasePath: ":memory:", development, seed, frozenClock: true });
}

export async function call(
  engine: Engine,
  method: string,
  path: string,
  options: { as?: string; body?: unknown } = {},
): Promise<Response> {
  const headers = new Headers();
  if (options.as !== undefined) {
    const opened = await engine.fetch(
      new Request("http://engine.test/_engine/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: options.as }),
      }),
    );
    if (opened.status === 200) {
      const token = sessionCookieOf(opened);
      if (token !== null) headers.set("Cookie", `vera_session=${token}`);
    }
  }
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  return engine.fetch(
    new Request(`http://engine.test${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
  );
}

export function sessionCookieOf(response: Response): string | null {
  const cookie = response.headers.get("Set-Cookie") ?? "";
  const match = /(?:^|,\s*)vera_session=([^;,]*)/.exec(cookie);
  return match?.[1] || null;
}
