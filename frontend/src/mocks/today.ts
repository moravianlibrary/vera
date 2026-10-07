// The mock server's today: the demo's (docs/demos), which its fixtures are dated around, so that
// a preset such as "the last 7 days" finds what the demo shows. A real server uses its own clock.

export const mockToday = new Date(2026, 5, 25);

// The mock server's clock, for what happens within a day: the demo's moment (2026-06-25 10:40,
// docs/demos `now`), standing still under tests and moving on in the browser once the worker
// starts, so a run started there makes progress and finishes.
const demoMoment = new Date(2026, 5, 25, 10, 40);
let clockStartedAt: number | null = null;

export function startMockClock(): void {
  clockStartedAt = Date.now();
}

export function mockNow(): Date {
  return clockStartedAt === null
    ? new Date(demoMoment)
    : new Date(demoMoment.getTime() + Date.now() - clockStartedAt);
}
