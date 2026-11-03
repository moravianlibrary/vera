import { describe, expect, it } from "bun:test";
import { call, testEngine } from "../../test/engine";

describe("decision writes", () => {
  it("approves all asks as one transaction and records one audit row per event", async () => {
    const engine = testEngine("base");
    const before = engine.db
      .query<{ record: string }, []>(
        "SELECT record FROM requests WHERE document_id='D20' ORDER BY rowid",
      )
      .all();
    const failedEventCount = engine.db
      .query<{ count: number }, []>("SELECT count(*) AS count FROM events")
      .get()?.count;
    engine.db.exec(
      "CREATE TRIGGER fail_second_decision BEFORE UPDATE ON requests WHEN OLD.id='R17' BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
    );
    const failed = await call(engine, "POST", "/api/requests/D20/approve", {
      as: "u3",
      body: { categoryId: "c21", priority: "Normal", rescanNote: null },
    });
    expect(failed.status).toBe(500);
    expect(
      engine.db
        .query<{ record: string }, []>(
          "SELECT record FROM requests WHERE document_id='D20' ORDER BY rowid",
        )
        .all(),
    ).toEqual(before);
    expect(
      engine.db.query<{ count: number }, []>("SELECT count(*) AS count FROM events").get()?.count,
    ).toBe(failedEventCount);
    engine.db.exec("DROP TRIGGER fail_second_decision");

    const outboxBefore =
      engine.db.query<{ count: number }, []>("SELECT count(*) AS count FROM audit_outbox").get()
        ?.count ?? 0;
    const response = await call(engine, "POST", "/api/requests/D20/approve", {
      as: "u3",
      body: { categoryId: "c21", priority: "Normal", rescanNote: "Re-scan from the newer copy." },
    });
    expect(response.status).toBe(200);
    const events = engine.db
      .query<
        { correlation_id: string; reason_internal: string | null; reason_public: string | null },
        []
      >(
        "SELECT correlation_id,reason_internal,reason_public FROM events WHERE code='request.approved' AND subject_id IN (SELECT id FROM requests WHERE document_id='D20') ORDER BY rowid",
      )
      .all();
    expect(events.length).toBe(4);
    expect(new Set(events.map((event) => event.correlation_id)).size).toBe(1);
    expect(events.map((event) => event.reason_internal)).toEqual(
      Array(4).fill("Re-scan from the newer copy."),
    );
    expect(events.map((event) => event.reason_public)).toEqual(Array(4).fill(null));
    expect(
      engine.db
        .query<{ count: number }, [string]>(
          "SELECT count(*) AS count FROM iterations WHERE document_id=?",
        )
        .get("D20")?.count,
    ).toBe(1);
    expect(
      engine.db
        .query<{ record: string }, [string]>(
          "SELECT record FROM requests WHERE document_id=? ORDER BY rowid",
        )
        .all("D20")
        .map(({ record }) => (JSON.parse(record) as { decision: string }).decision),
    ).toEqual(Array(4).fill("Approved"));
    expect(
      (engine.db.query<{ count: number }, []>("SELECT count(*) AS count FROM audit_outbox").get()
        ?.count ?? 0) - outboxBefore,
    ).toBe(4);
    engine.close();
  });
});
