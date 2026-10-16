// Pure timing rules for Hooks' quiet wait, hard deadline and retry spacing
// (STATUS "Hooks"; plugins.md §4.12).

export interface HookBatch {
  readonly waitMinutes: number;
  readonly maxMinutes: number;
  readonly by: "recipient" | "all";
}

export interface HookRetry {
  readonly attempts: number;
  readonly backoff: "fixed" | "exponential";
}

const minute = 60_000;

export function sendAtOf(firstAt: Date, lastAt: Date, batch: HookBatch): Date {
  return new Date(
    Math.min(
      lastAt.getTime() + batch.waitMinutes * minute,
      firstAt.getTime() + batch.maxMinutes * minute,
    ),
  );
}

// The first attempt is immediate; growing retries wait 1, 2, 4… minutes,
// while a fixed retry waits 5 minutes each time (Hooks demo retry wording).
export function retryAtOf(failedAt: Date, failedAttempt: number, retry: HookRetry): Date | null {
  if (failedAttempt >= retry.attempts) {
    return null;
  }

  const waitMinutes = retry.backoff === "fixed" ? 5 : 2 ** (failedAttempt - 1);
  return new Date(failedAt.getTime() + waitMinutes * minute);
}
