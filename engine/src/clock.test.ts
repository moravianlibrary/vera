import { beforeEach, describe, expect, it } from "bun:test";
import type { Clock } from "./clock";
import { ClockError, createClock } from "./clock";
import { applySchema, openDatabase, readSchema } from "./db";

const seedMoment = new Date("2026-06-25T08:40:00.000Z");
let wall = 1_000_000;
let clock: Clock;

beforeEach(() => {
  const db = openDatabase(":memory:");
  applySchema(db, readSchema());
  wall = 1_000_000;
  clock = createClock(db, () => wall);
});

describe("the clock", () => {
  it("is not set before a reset", () => {
    expect(() => clock.now()).toThrow(ClockError);
  });

  it("stands still while frozen", () => {
    clock.reset(seedMoment, true);
    wall += 60_000;
    expect(clock.now()).toEqual(seedMoment);
    expect(clock.isFrozen()).toBe(true);
  });

  it("moves on with the wall clock while running", () => {
    clock.reset(seedMoment, false);
    wall += 60_000;
    expect(clock.now().toISOString()).toBe("2026-06-25T08:41:00.000Z");
  });

  it("is set or advanced forward only", () => {
    clock.reset(seedMoment, true);
    clock.advance(24 * 60 * 60 * 1000);
    expect(clock.now().toISOString()).toBe("2026-06-26T08:40:00.000Z");
    clock.set(new Date("2026-07-01T00:00:00.000Z"));
    expect(clock.now().toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(() => clock.set(seedMoment)).toThrow(ClockError);
    expect(() => clock.advance(-1)).toThrow(ClockError);
  });

  it("keeps its moment when frozen or unfrozen", () => {
    clock.reset(seedMoment, false);
    wall += 1000;
    clock.freeze();
    wall += 5000;
    expect(clock.now().toISOString()).toBe("2026-06-25T08:40:01.000Z");
    clock.unfreeze();
    wall += 1000;
    expect(clock.now().toISOString()).toBe("2026-06-25T08:40:02.000Z");
  });
});
