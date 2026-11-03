import { describe, expect, it } from "bun:test";
import { testEngine } from "../test/engine";
import { newCorrelationId, recordEvent } from "./events";

describe("recordEvent", () => {
  it("writes History and Audit for a code sent to both", () => {
    const engine = testEngine();
    recordEvent(engine, {
      code: "request.created",
      subjectKind: "request",
      subjectId: "R1",
      actor: { kind: "system" },
      correlationId: newCorrelationId(),
      data: { batch: null, source: null },
    });
    expect(engine.db.query<{ n: number }, []>("SELECT count(*) AS n FROM events").get()?.n).toBe(1);
    expect(
      engine.db.query<{ n: number }, []>("SELECT count(*) AS n FROM audit_outbox").get()?.n,
    ).toBe(1);
    engine.close();
  });
  it("writes configuration events only to Audit and refuses derived codes or wrong subjects", () => {
    const engine = testEngine();
    recordEvent(engine, {
      code: "user.created",
      subjectKind: "user",
      subjectId: "u1",
      actor: { kind: "system" },
      correlationId: "c1",
      data: { changes: [] },
    });
    expect(engine.db.query<{ n: number }, []>("SELECT count(*) AS n FROM events").get()?.n).toBe(0);
    expect(
      engine.db.query<{ n: number }, []>("SELECT count(*) AS n FROM audit_outbox").get()?.n,
    ).toBe(1);
    expect(() =>
      recordEvent(engine, {
        code: "list.started",
        subjectKind: "list",
        subjectId: "L1",
        actor: { kind: "system" },
        correlationId: "c2",
        data: { changes: [] },
      }),
    ).toThrow();
    expect(() =>
      recordEvent(engine, {
        code: "request.created",
        subjectKind: "list",
        subjectId: "L1",
        actor: { kind: "system" },
        correlationId: "c3",
        data: { batch: null, source: null },
      } as never),
    ).toThrow();
    engine.close();
  });
  it("keeps undisclosed actors anonymous and throws for a missing user actor", () => {
    const engine = testEngine();
    recordEvent(engine, {
      code: "user.created",
      subjectKind: "user",
      subjectId: "u1",
      actor: { kind: "undisclosed" },
      correlationId: "c1",
      data: { changes: [] },
    });
    const record = engine.db.query<{ record: string }, []>("SELECT record FROM audit_outbox").get();
    expect(JSON.parse(record?.record ?? "{}").actor).toEqual({ kind: "reader" });
    expect(() =>
      recordEvent(engine, {
        code: "user.created",
        subjectKind: "user",
        subjectId: "u1",
        actor: { kind: "user", userId: "missing" },
        correlationId: "c2",
        data: { changes: [] },
      }),
    ).toThrow("no user missing");
    engine.close();
  });
  it("rolls back both destinations with the act transaction", () => {
    const engine = testEngine();
    expect(() =>
      engine.db.transaction(() => {
        recordEvent(engine, {
          code: "request.created",
          subjectKind: "request",
          subjectId: "R1",
          actor: { kind: "system" },
          correlationId: "c1",
          data: { batch: null, source: null },
        });
        throw new Error("act failed");
      })(),
    ).toThrow("act failed");
    expect(engine.db.query<{ n: number }, []>("SELECT count(*) AS n FROM events").get()?.n).toBe(0);
    expect(
      engine.db.query<{ n: number }, []>("SELECT count(*) AS n FROM audit_outbox").get()?.n,
    ).toBe(0);
    engine.close();
  });
});
