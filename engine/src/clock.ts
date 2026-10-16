// The engine's movable clock. Engine time is kept in the database, so it survives a restart: the
// moment last set and, while it runs, the wall time it was set at. A frozen clock stands still
// (tests); a running one moves on with the wall clock (development). It only moves forward;
// going back is a reset to a seed.

import type { Database } from "bun:sqlite";

export class ClockError extends Error {}

export interface Clock {
  now(): Date;
  isFrozen(): boolean;
  // To a later moment; an earlier one throws ClockError.
  set(at: Date): void;
  advance(milliseconds: number): void;
  freeze(): void;
  unfreeze(): void;
  // The seed's moment, however far the clock had gone.
  reset(at: Date, frozen: boolean): void;
}

const atKey = "clock.at";
const wallKey = "clock.wall";

export function createClock(db: Database, wallNow: () => number = Date.now): Clock {
  const read = (key: string): string | null =>
    db.query<{ value: string }, [string]>("SELECT value FROM engine_state WHERE key = ?").get(key)
      ?.value ?? null;
  const write = (key: string, value: string) =>
    db
      .query(
        "INSERT INTO engine_state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      )
      .run(key, value);

  // An empty wall value means frozen.
  const store = (at: Date, frozen: boolean) => {
    write(atKey, at.toISOString());
    write(wallKey, frozen ? "" : String(wallNow()));
  };

  const clock: Clock = {
    now() {
      const at = read(atKey);
      if (at === null) {
        throw new ClockError("The clock is not set; reset the engine to a seed first.");
      }

      const wall = read(wallKey);
      const elapsed = wall === null || wall === "" ? 0 : wallNow() - Number(wall);
      return new Date(new Date(at).getTime() + elapsed);
    },
    isFrozen() {
      return (read(wallKey) ?? "") === "";
    },
    set(at) {
      if (at.getTime() < clock.now().getTime()) {
        throw new ClockError(`The clock only moves forward; it is ${clock.now().toISOString()}.`);
      }

      store(at, clock.isFrozen());
    },
    advance(milliseconds) {
      if (milliseconds < 0) {
        throw new ClockError("The clock only moves forward.");
      }

      store(new Date(clock.now().getTime() + milliseconds), clock.isFrozen());
    },
    freeze() {
      store(clock.now(), true);
    },
    unfreeze() {
      store(clock.now(), false);
    },
    reset(at, frozen) {
      store(at, frozen);
    },
  };
  return clock;
}
