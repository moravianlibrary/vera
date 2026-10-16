// A test engine: in memory, development on, clock frozen at the seed's moment.

import { devPersonHeader } from "../src/access/caller";
import type { Engine } from "../src/engine";
import { createEngine } from "../src/engine";

export function testEngine(seed = "minimal", development = true): Engine {
  return createEngine({ databasePath: ":memory:", development, seed, frozenClock: true });
}

export function call(
  engine: Engine,
  method: string,
  path: string,
  options: { as?: string; body?: unknown } = {},
): Promise<Response> {
  const headers = new Headers();
  if (options.as !== undefined) {
    headers.set(devPersonHeader, options.as);
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
