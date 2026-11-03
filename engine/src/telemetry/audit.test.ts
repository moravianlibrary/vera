import { describe, expect, it } from "bun:test";
import { testEngine } from "../../test/engine";
import { sendAudit } from "./audit";

function add(engine: ReturnType<typeof testEngine>, subjectId: string) {
  const record = {
    code: "user.created",
    at: "2026-06-25T08:40:00.000Z",
    correlationId: "c1",
    traceId: null,
    subject: { kind: "user", id: subjectId, name: null },
    actor: { kind: "system" },
    changes: [],
    data: null,
  };
  engine.db
    .query("INSERT INTO audit_outbox (at,record) VALUES (?,?)")
    .run(record.at, JSON.stringify(record));
}

describe("sendAudit", () => {
  it("sends the OTLP records and removes only rows included in the request", async () => {
    const engine = testEngine();
    add(engine, "u1");
    const result = await sendAudit(
      engine,
      { endpoint: "http://collector", key: "secret" },
      async (input, init) => {
        add(engine, "u2");
        expect(input).toBe("http://collector/v1/logs");
        expect(((init?.headers ?? {}) as Record<string, string>).authorization).toBe("secret");
        const request = JSON.parse(String(init?.body));
        expect(request.resourceLogs[0].scopeLogs[0].scope.name).toBe("vera.audit");
        expect(request.resourceLogs[0].scopeLogs[0].logRecords[0].attributes).toContainEqual({
          key: "vera.stream",
          value: { stringValue: "audit" },
        });
        expect(JSON.stringify(request)).not.toContain("reason");
        return new Response(null, { status: 200 });
      },
    );
    expect(result).toEqual({ sent: 1, kept: 0 });
    expect(engine.db.query<{ id: number }, []>("SELECT id FROM audit_outbox").all()).toHaveLength(
      1,
    );
    engine.close();
  });
  it("keeps all selected rows after a non-2xx response or a thrown fetch", async () => {
    const engine = testEngine();
    add(engine, "u1");
    expect(
      await sendAudit(
        engine,
        { endpoint: "http://collector", key: undefined },
        async () => new Response(null, { status: 500 }),
      ),
    ).toEqual({ sent: 0, kept: 1 });
    expect(
      await sendAudit(engine, { endpoint: "http://collector", key: undefined }, async () => {
        throw new Error("offline");
      }),
    ).toEqual({ sent: 0, kept: 1 });
    engine.close();
  });
});
