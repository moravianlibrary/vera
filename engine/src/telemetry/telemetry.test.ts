import { afterAll, describe, expect, it } from "bun:test";
import { InMemoryLogRecordExporter } from "@opentelemetry/sdk-logs";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace";
import { call, testEngine } from "../../test/engine";
import { currentTraceParent, startTelemetry, stopTelemetry, withApiSpan } from "./telemetry";

const spans = new InMemorySpanExporter();
const logs = new InMemoryLogRecordExporter();
const engine = testEngine("base");
const incomingTrace = "0123456789abcdef0123456789abcdef";
const incomingSpan = "0123456789abcdef";
const parent = `00-${incomingTrace}-${incomingSpan}-01`;
const finished = () => spans.getFinishedSpans();

describe("engine telemetry", () => {
  it("is a no-op before start", async () => {
    const response = await withApiSpan(
      new Request("http://engine.test/api/session"),
      "/api/session",
      async () => new Response("ok"),
    );
    expect(await response.text()).toBe("ok");
    expect(currentTraceParent()).toBeNull();
  });

  it("continues traceparent and records only the route template and status", async () => {
    await startTelemetry({ endpoint: "memory:", key: undefined }, { spans, logs });
    await engine.fetch(
      new Request(
        "http://engine.test/api/login/pi22/callback?code=filled-secret&flow=query-secret",
        { headers: { traceparent: parent } },
      ),
    );
    const span = finished().find((item) => item.name === "GET /api/login/:instanceId/callback");
    expect(span?.spanContext().traceId).toBe(incomingTrace);
    expect(span?.parentSpanContext?.spanId).toBe(incomingSpan);
    expect(span?.attributes["http.route"]).toBe("/api/login/:instanceId/callback");
    expect(span?.attributes["http.response.status_code"]).toBeDefined();
    expect(JSON.stringify(span?.attributes)).not.toContain("filled-secret");
    expect(JSON.stringify(span?.attributes)).not.toContain("query-secret");
  });

  it("names staff callers and omits reader callers", async () => {
    const people = engine.db.query<{ id: string }, []>("SELECT id FROM users ORDER BY rowid").all();
    const reader = people.find(
      ({ id }) =>
        engine.db
          .query("SELECT 1 FROM user_mapped_roles WHERE user_id = ? AND role_id = 'reader'")
          .get(id) !== null,
    )?.id;
    const staff = people.find(
      ({ id }) =>
        engine.db
          .query("SELECT 1 FROM user_mapped_roles WHERE user_id = ? AND role_id != 'reader'")
          .get(id) !== null,
    )?.id;
    if (!reader || !staff) throw new Error("Expected seed users for reader and staff");
    await call(engine, "GET", "/api/session", { as: reader });
    await call(engine, "GET", "/api/session", { as: staff });
    const recent = finished().slice(-2);
    expect(recent[0]?.attributes["enduser.id"]).toBeUndefined();
    expect(recent[1]?.attributes["enduser.id"]).toBe(staff);
  });

  it("keeps an enqueued job in the API trace", async () => {
    let jobId = 0;
    await withApiSpan(new Request("http://engine.test/api/session"), "/api/session", async () => {
      jobId = engine.jobs.enqueue("telemetry-test", engine.clock.now(), { requestId: "R1" });
      return new Response("ok");
    });
    engine.jobs.register("telemetry-test", () => {});
    engine.jobs.runDue();
    const job = finished().find((span) => span.name === "job telemetry-test");
    const apiSpan = finished().find(
      (span) =>
        span.name === "GET /api/session" &&
        span.spanContext().traceId === job?.spanContext().traceId,
    );
    expect(jobId).toBeGreaterThan(0);
    expect(job?.spanContext().traceId).toBe(apiSpan?.spanContext().traceId);
  });

  it("records failed jobs and a trace-linked error log", async () => {
    engine.jobs.register("telemetry-failure", () => {
      throw new Error("job failed");
    });
    engine.jobs.enqueue("telemetry-failure", engine.clock.now(), { requestId: "R2" });
    engine.jobs.runDue();
    const job = finished().find((span) => span.name === "job telemetry-failure");
    expect(job?.attributes["vera.job.outcome"]).toBe("failed");
    expect(job?.status.code).toBe(2);
    const record = logs.getFinishedLogRecords().find((item) => item.body === "job failed");
    expect(record?.spanContext?.traceId).toBe(job?.spanContext().traceId);
  });

  it("records a fake redirect identity result without its code or email", async () => {
    const start = await call(engine, "GET", "/api/login/pi22");
    const flow = new URL(
      start.headers.get("Location") ?? "",
      "http://engine.test",
    ).searchParams.get("flow");
    const account = engine.db
      .query<{ external_id: string }, [string]>(
        "SELECT external_id FROM fake_identity_accounts WHERE instance_id = ? LIMIT 1",
      )
      .get("pi22");
    if (!flow || !account) throw new Error("Expected fake redirect fixtures");
    await call(
      engine,
      "GET",
      `/api/login/pi22/callback?flow=${flow}&code=${encodeURIComponent(account.external_id)}`,
    );
    const plugin = finished().find((span) => span.name.startsWith("plugin "));
    expect(plugin?.attributes["vera.plugin.outcome"]).toBe("answered");
    expect(JSON.stringify(plugin?.attributes)).not.toContain(account.external_id);
    expect(JSON.stringify(plugin?.attributes)).not.toContain("@");
  });

  it("starts cleanly again after stop and records linked API and job spans", async () => {
    await stopTelemetry();
    const secondSpans = new InMemorySpanExporter();
    const secondLogs = new InMemoryLogRecordExporter();
    await startTelemetry(
      { endpoint: "memory:", key: undefined },
      {
        spans: secondSpans,
        logs: secondLogs,
      },
    );
    await withApiSpan(new Request("http://engine.test/api/session"), "/api/session", async () => {
      engine.jobs.enqueue("second-start", engine.clock.now());
      return new Response("ok");
    });
    engine.jobs.register("second-start", () => {});
    engine.jobs.runDue();
    const secondFinished = secondSpans.getFinishedSpans();
    const apiSpan = secondFinished.find((span) => span.name === "GET /api/session");
    const jobSpan = secondFinished.find((span) => span.name === "job second-start");
    expect(apiSpan).toBeDefined();
    expect(jobSpan?.spanContext().traceId).toBe(apiSpan?.spanContext().traceId);
  });
});

afterAll(async () => {
  await stopTelemetry();
  engine.close();
});
