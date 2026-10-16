// Jobs: work due at a moment of the engine's clock. A command or another job enqueues one; the
// clock moving, or POST /_engine/jobs/run, runs the due ones. Each runs in its own transaction:
// a job that throws leaves nothing behind and is marked failed. The kinds are registered by
// the steps that need them; step 1 has none of its own.

import type { Database } from "bun:sqlite";
import type { Clock } from "./clock";

export interface Job {
  id: number;
  kind: string;
  dueAt: string;
  payload: unknown;
}

export type JobHandler = (job: Job) => void;

export interface RunReport {
  ran: number;
  failed: number;
}

export interface Jobs {
  enqueue(kind: string, dueAt: Date, payload?: unknown): number;
  runDue(): RunReport;
  register(kind: string, handler: JobHandler): void;
}

// A job may enqueue another that is due already; this bounds a chain that never ends.
const maxRunsAtOnce = 10_000;

export function createJobs(db: Database, clock: Clock): Jobs {
  const handlers = new Map<string, JobHandler>();

  const nextDue = () =>
    db
      .query<{ id: number; kind: string; due_at: string; payload: string }, [string]>(
        "SELECT id, kind, due_at, payload FROM jobs WHERE state = 'due' AND due_at <= ? ORDER BY due_at, id LIMIT 1",
      )
      .get(clock.now().toISOString());

  const mark = (id: number, state: "done" | "failed", error: string | null) =>
    db
      .query("UPDATE jobs SET state = ?, ran_at = ?, error = ? WHERE id = ?")
      .run(state, clock.now().toISOString(), error, id);

  return {
    enqueue(kind, dueAt, payload = {}) {
      const row = db
        .query<{ id: number }, [string, string, string]>(
          "INSERT INTO jobs (kind, due_at, payload) VALUES (?, ?, ?) RETURNING id",
        )
        .get(kind, dueAt.toISOString(), JSON.stringify(payload));
      return row?.id ?? 0;
    },
    register(kind, handler) {
      handlers.set(kind, handler);
    },
    runDue() {
      const report: RunReport = { ran: 0, failed: 0 };
      for (let count = 0; count < maxRunsAtOnce; count += 1) {
        const row = nextDue();
        if (row === null) {
          return report;
        }

        const job: Job = {
          id: row.id,
          kind: row.kind,
          dueAt: row.due_at,
          payload: JSON.parse(row.payload),
        };
        const handler = handlers.get(job.kind);
        try {
          if (handler === undefined) {
            throw new Error(`No handler for jobs of kind ${job.kind}`);
          }

          db.transaction(() => {
            handler(job);
            mark(job.id, "done", null);
          })();
          report.ran += 1;
        } catch (error) {
          mark(job.id, "failed", error instanceof Error ? error.message : String(error));
          report.failed += 1;
        }
      }

      throw new Error(`More than ${maxRunsAtOnce} jobs were due at once`);
    },
  };
}
