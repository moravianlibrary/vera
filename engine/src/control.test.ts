// The control endpoints.

import { beforeEach, describe, expect, it } from "bun:test";
import { call, testEngine } from "../test/engine";
import type { Engine } from "./engine";

let engine: Engine;

beforeEach(() => {
  engine = testEngine();
});

describe("/_engine", () => {
  it("resets to a seed: its records and its moment", async () => {
    engine.db.query("DELETE FROM dev_people").run();
    engine.clock.advance(60_000);
    const response = await call(engine, "POST", "/_engine/reset", { body: { seed: "minimal" } });
    expect(await response.json()).toEqual({ seed: "minimal", now: "2026-06-25T08:40:00.000Z" });
    expect((await call(engine, "GET", "/api/session", { as: "curator" })).status).toBe(200);
  });

  it("refuses a seed that does not exist, and keeps the database", async () => {
    const response = await call(engine, "POST", "/_engine/reset", { body: { seed: "../etc" } });
    expect(response.status).toBe(404);
    expect((await call(engine, "GET", "/api/session", { as: "curator" })).status).toBe(200);
  });

  it("moves the clock forward and runs what is due", async () => {
    const seen: string[] = [];
    engine.jobs.register("note", () => seen.push("ran"));
    engine.jobs.enqueue("note", new Date("2026-06-26T08:40:00.000Z"));
    const response = await call(engine, "POST", "/_engine/clock", {
      body: { advance: { days: 1 } },
    });
    expect(await response.json()).toEqual({
      now: "2026-06-26T08:40:00.000Z",
      frozen: true,
      ran: 1,
      failed: 0,
    });
    expect(seen).toEqual(["ran"]);
  });

  it("refuses to move the clock back", async () => {
    const response = await call(engine, "POST", "/_engine/clock", {
      body: { at: "2026-01-01T00:00:00Z" },
    });
    expect(response.status).toBe(409);
  });

  it("refuses setting and advancing at once", async () => {
    const response = await call(engine, "POST", "/_engine/clock", {
      body: { at: "2027-01-01T00:00:00Z", advance: { days: 1 } },
    });
    expect(response.status).toBe(422);
  });

  it("reads the outbox, by channel", async () => {
    engine.outbox.send("mail", "a@example.org", { subject: "Hello" });
    engine.outbox.send("chat", "@a", { text: "Hi" });
    const all = await (await call(engine, "GET", "/_engine/outbox")).json();
    expect(all).toHaveLength(2);
    const mail = (await (await call(engine, "GET", "/_engine/outbox?channel=mail")).json()) as {
      recipient: string;
    }[];
    expect(mail.map(({ recipient }) => recipient)).toEqual(["a@example.org"]);
    expect((await call(engine, "GET", "/_engine/outbox?channel=fax")).status).toBe(422);
  });

  it("runs the due jobs on demand", async () => {
    engine.jobs.register("note", () => {});
    engine.jobs.enqueue("note", engine.clock.now());
    expect(await (await call(engine, "POST", "/_engine/jobs/run")).json()).toEqual({
      ran: 1,
      failed: 0,
    });
  });

  it("is not served outside development", async () => {
    const production = testEngine("minimal", false);
    expect((await call(production, "POST", "/_engine/jobs/run")).status).toBe(404);
  });
});
