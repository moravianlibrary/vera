import { describe, expect, it } from "bun:test";
import { call, testEngine } from "../../test/engine";

const draft = {
  items: [{ type: "catalogId", value: "MZK03-000778120", unit: null, reason: null }],
  reason: "For the reading room",
  projectId: "p3",
  batchName: "New proposal",
  approval: null,
  entrySourceId: null,
};

describe("proposal endpoints", () => {
  it("writes a submission and its request events together", async () => {
    const engine = testEngine("base");
    const response = await call(engine, "POST", "/api/proposals", { as: "u4", body: draft });
    expect(response.status).toBe(201);
    const report = (await response.json()) as { batch: { id: string }; proposed: number };
    expect(report.proposed).toBe(1);
    expect(engine.db.query("SELECT id FROM batches WHERE id=?").get(report.batch.id)).toBeTruthy();
    const request = engine.db
      .query<{ id: string; document_id: string; batch_id: string; record: string }, [string]>(
        "SELECT * FROM requests WHERE batch_id=?",
      )
      .all(report.batch.id)[0];
    expect(request).toBeDefined();
    const created = engine.db
      .query<{ code: string; subject_id: string; correlation_id: string }, [string]>(
        "SELECT code,subject_id,correlation_id FROM events WHERE subject_id=?",
      )
      .all(request?.id);
    expect(created.map(({ code }) => code)).toEqual(["request.created"]);
    expect(new Set(created.map(({ correlation_id }) => correlation_id)).size).toBe(1);
    const requests = await call(engine, "GET", "/api/requests", { as: "u3" });
    expect(requests.status).toBe(200);
    const page = (await requests.json()) as {
      items: { record: { requests: { id: string }[] }; custodyIds: string[] }[];
    };
    const proposedRow = page.items.find((item) =>
      item.record.requests.some((entry) => entry.id === request?.id),
    );
    expect(proposedRow?.custodyIds).toContain("pc3");
    engine.close();
  });

  it("rolls every proposal table back when a write fails", async () => {
    const engine = testEngine("base");
    const before = Object.fromEntries(
      ["batches", "documents", "iterations", "requests", "events"].map((table) => [
        table,
        engine.db.query<{ n: number }, []>(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n,
      ]),
    );
    engine.db.exec(
      "CREATE TRIGGER fail_proposal_request BEFORE INSERT ON requests BEGIN SELECT RAISE(ABORT, 'forced'); END",
    );
    const response = await call(engine, "POST", "/api/proposals", { as: "u4", body: draft });
    expect(response.status).toBe(500);
    for (const table of ["batches", "documents", "iterations", "requests", "events"])
      expect(
        engine.db.query<{ n: number }, []>(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n,
      ).toBe(before[table]);
    engine.close();
  });

  it("counts the caller's stored requests against the library-day limit", async () => {
    const engine = testEngine("base");
    const roleIds = engine.db
      .query<{ role_id: string }, [string, string]>(
        "SELECT role_id FROM user_hand_roles WHERE user_id=? UNION SELECT role_id FROM user_mapped_roles WHERE user_id=?",
      )
      .all("u4", "u4");
    for (const { role_id } of roleIds)
      engine.db.query("UPDATE roles SET proposal_daily_limit=1 WHERE id=?").run(role_id);
    const first = await call(engine, "POST", "/api/proposals", { as: "u4", body: draft });
    expect(first.status).toBe(201);
    const secondDraft = {
      ...draft,
      items: [{ type: "catalogId", value: "MZK01-001277001", unit: "1936–1938", reason: null }],
    };
    const response = await call(engine, "POST", "/api/proposals", { as: "u4", body: secondDraft });
    expect(response.status).toBe(429);
    expect(((await response.json()) as { code: string }).code).toBe("proposal.daily_limit");
    engine.close();
  });
});
