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
    const access = await call(engine, "GET", "/api/access", { as: "u3" });
    expect(access.status).toBe(200);
    const index = (await access.json()) as {
      custodies: { id: string; openCount: number }[];
      proposals: { id: string; custodyIds: string[] }[];
    };
    expect(index.custodies.find((custody) => custody.id === "pc3")?.openCount).toBeGreaterThan(0);
    expect(index.proposals.some((proposal) => proposal.custodyIds.includes("pc3"))).toBe(true);
    engine.close();
  });

  it("queues and runs one copy check for each submitted proposal", async () => {
    const engine = testEngine("base");
    const response = await call(engine, "POST", "/api/proposals", {
      as: "u4",
      body: {
        ...draft,
        projectId: null,
        items: [{ type: "catalogId", value: "MZK01-001277001", unit: "1939", reason: null }],
      },
    });
    expect(response.status).toBe(201);
    expect(
      engine.db
        .query<{ n: number }, []>(
          "SELECT COUNT(*) AS n FROM jobs WHERE kind='proposal.check' AND state='due'",
        )
        .get()?.n,
    ).toBe(1);
    const ran = await call(engine, "POST", "/_engine/jobs/run");
    expect(await ran.json()).toEqual({ ran: 1, failed: 0 });
    const request = engine.db
      .query<{ record: string; document_id: string }, []>(
        "SELECT record,document_id FROM requests ORDER BY rowid DESC LIMIT 1",
      )
      .get();
    const checked = JSON.parse(request?.record ?? "{}");
    expect(checked.checkedAt).not.toBeNull();
    expect(checked.existingCopies).toMatchObject([
      {
        source: "Kramerius",
        state: "Published",
        link: "https://kramerius.mzk.cz/view/uuid:demo-new-volume",
      },
    ]);
    const document = engine.db
      .query<{ record: string }, [string]>("SELECT record FROM documents WHERE id=?")
      .get(request?.document_id ?? "");
    expect(JSON.parse(document?.record ?? "{}").registryRecords).toMatchObject([
      {
        registry: "Kramerius",
        state: "Published",
        url: "https://kramerius.mzk.cz/view/uuid:demo-new-volume",
      },
    ]);
    engine.close();
  });

  it("holds approve-now until checking, then approves only when no copy exists", async () => {
    const engine = testEngine("base");
    const response = await call(engine, "POST", "/api/proposals", {
      as: "u3",
      body: {
        ...draft,
        projectId: null,
        items: [{ type: "catalogId", value: "MZK03-000778120", unit: null, reason: null }],
        approval: { categoryId: "c21", priority: "Normal" },
      },
    });
    expect(response.status).toBe(201);
    const request = engine.db
      .query<{ id: string; record: string }, []>(
        "SELECT id,record FROM requests ORDER BY rowid DESC LIMIT 1",
      )
      .get();
    expect(JSON.parse(request?.record ?? "{}").decision).toBe("Pending");
    const held = engine.db
      .query<{ code: string }, [string]>(
        "SELECT code FROM events WHERE subject_id=? ORDER BY rowid",
      )
      .all(request?.id ?? "");
    expect(held.map(({ code }) => code)).toEqual(["request.created", "request.held"]);
    await call(engine, "POST", "/_engine/jobs/run");
    const checked = engine.db
      .query<{ record: string }, [string]>("SELECT record FROM requests WHERE id=?")
      .get(request?.id ?? "");
    const final = JSON.parse(checked?.record ?? "{}");
    expect(final.decision).toBe("Approved");
    expect(final.existingCopies).toEqual([]);
    const iterations = engine.db
      .query<{ record: string }, []>("SELECT record FROM iterations")
      .all();
    expect(iterations.some(({ record }) => JSON.parse(record).requestId === request?.id)).toBe(
      true,
    );
    engine.close();
  });

  it("leaves approve-now Pending when the check finds one copy", async () => {
    const engine = testEngine("base");
    await call(engine, "POST", "/api/proposals", {
      as: "u3",
      body: {
        ...draft,
        projectId: null,
        approval: { categoryId: "c21", priority: "Normal" },
      },
    });
    const request = engine.db
      .query<{ id: string; document_id: string }, []>(
        "SELECT id,document_id FROM requests ORDER BY rowid DESC LIMIT 1",
      )
      .get();
    const doc = engine.db
      .query<{ record: string }, [string]>("SELECT record FROM documents WHERE id=?")
      .get(request?.document_id ?? "");
    const record = JSON.parse(doc?.record ?? "{}");
    record.registryRecords = [
      { registry: "Other", state: "Published", url: "https://example.org/copy" },
    ];
    engine.db
      .query("UPDATE documents SET record=? WHERE id=?")
      .run(JSON.stringify(record), request?.document_id ?? "");
    await call(engine, "POST", "/_engine/jobs/run");
    const checked = engine.db
      .query<{ record: string }, [string]>("SELECT record FROM requests WHERE id=?")
      .get(request?.id ?? "");
    const final = JSON.parse(checked?.record ?? "{}");
    expect(final.decision).toBe("Pending");
    expect(final.existingCopies).toHaveLength(1);
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
