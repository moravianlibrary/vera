import type { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import type { Clock } from "./clock";
import { createClock } from "./clock";
import { applySchema, openDatabase, readSchema } from "./db";
import type { Jobs } from "./jobs";
import { createJobs } from "./jobs";
import { createOutbox } from "./outbox";

const hour = 60 * 60 * 1000;
let db: Database;
let clock: Clock;
let jobs: Jobs;

function stateOf(id: number) {
  return db
    .query<{ state: string; error: string | null }, [number]>(
      "SELECT state, error FROM jobs WHERE id = ?",
    )
    .get(id);
}

beforeEach(() => {
  db = openDatabase(":memory:");
  applySchema(db, readSchema());
  clock = createClock(db);
  clock.reset(new Date("2026-06-25T08:40:00.000Z"), true);
  jobs = createJobs(db, clock);
});

describe("jobs", () => {
  it("run when due, in the order they are due", () => {
    const seen: unknown[] = [];
    jobs.register("note", (job) => seen.push(job.payload));
    jobs.enqueue("note", new Date(clock.now().getTime() + 2 * hour), { n: 2 });
    jobs.enqueue("note", new Date(clock.now().getTime() + hour), { n: 1 });
    expect(jobs.runDue()).toEqual({ ran: 0, failed: 0 });
    clock.advance(3 * hour);
    expect(jobs.runDue()).toEqual({ ran: 2, failed: 0 });
    expect(seen).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it("run a job that a due job enqueues for now", () => {
    jobs.register("first", () => {
      jobs.enqueue("second", clock.now());
    });
    jobs.register("second", () => {});
    jobs.enqueue("first", clock.now());
    expect(jobs.runDue()).toEqual({ ran: 2, failed: 0 });
  });

  it("mark a failing job failed and keep nothing it wrote", () => {
    const outbox = createOutbox(db, clock);
    jobs.register("boom", () => {
      outbox.send("mail", "someone@example.org", { subject: "half" });
      throw new Error("broke");
    });
    const id = jobs.enqueue("boom", clock.now());
    expect(jobs.runDue()).toEqual({ ran: 0, failed: 1 });
    expect(stateOf(id)).toEqual({ state: "failed", error: "broke" });
    expect(outbox.list()).toEqual([]);
  });

  it("fail a job nobody handles", () => {
    const id = jobs.enqueue("unknown", clock.now());
    expect(jobs.runDue()).toEqual({ ran: 0, failed: 1 });
    expect(stateOf(id)?.error).toBe("No handler for jobs of kind unknown");
  });
});

describe("the outbox", () => {
  it("keeps what was sent, by channel, stamped with the engine's time", () => {
    const outbox = createOutbox(db, clock);
    outbox.send("mail", "a@example.org", { subject: "Hello" });
    outbox.send("chat", "@a", { text: "Hi" });
    expect(outbox.list("mail")).toEqual([
      {
        id: 1,
        channel: "mail",
        recipient: "a@example.org",
        payload: { subject: "Hello" },
        sentAt: "2026-06-25T08:40:00.000Z",
      },
    ]);
    expect(outbox.list().map(({ channel }) => channel)).toEqual(["mail", "chat"]);
  });
});
