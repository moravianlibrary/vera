import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { call, testEngine } from "../../test/engine";

interface GoldenCall {
  as?: string;
  method: string;
  path: string;
  status: number;
  body?: unknown;
  requestBody?: unknown;
  formPhotoSize?: number;
}
interface GoldenPerson {
  profile: string;
  userId: string;
  calls: GoldenCall[];
}
interface GoldenScenario {
  name: string;
  submitterId: string;
  projectId: string | null;
  calls: GoldenCall[];
}
const golden = JSON.parse(
  readFileSync(join(import.meta.dir, "../../test/base-proposals.json"), "utf8"),
) as { people: GoldenPerson[]; scenarios: GoldenScenario[]; scenarioCProjectUsed: string };
function maskWith(value: unknown, ids: Map<string, string>): unknown {
  if (Array.isArray(value)) return value.map((item) => maskWith(item, ids));
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, maskWith(item, ids)]),
    );
  if (typeof value === "string") {
    if (
      /^(?:B-[\w-]+|D(?:\d+|-[\da-f-]{36})|R(?:\d+|-[\da-f-]{36})|IT(?:\d+|-[\da-f-]{36})|E-[\da-f-]{36}|[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})$/i.test(
        value,
      )
    ) {
      let token = ids.get(value);
      if (token === undefined) {
        const prefix = value.startsWith("B-")
          ? "B"
          : value.startsWith("IT")
            ? "IT"
            : value.startsWith("E-")
              ? "E"
              : value.startsWith("D")
                ? "D"
                : value.startsWith("R")
                  ? "R"
                  : "U";
        const count =
          [...ids.values()].filter((entry) => entry.startsWith(`<${prefix}`)).length + 1;
        token = `<${prefix}${count}>`;
        ids.set(value, token);
      }
      return token;
    }
    if (/^\d{4}-\d\d-\d\dT/.test(value)) return "<time>";
  }
  return value;
}

async function replayScenario(scenario: GoldenScenario): Promise<void> {
  const engine = testEngine("base");
  const ids = new Map<string, string>();
  const [submission, ...followups] = scenario.calls;
  if (submission === undefined) throw new Error(`${scenario.name}: missing submission`);
  const response = await call(engine, submission.method, submission.path, {
    as: scenario.submitterId,
    body: submission.requestBody,
  });
  expect(response.status, `${scenario.name} submission status`).toBe(submission.status);
  const report = await response.json();
  expect(maskWith(report, ids), `${scenario.name} submission`).toEqual(submission.body);
  const batchId = (report as { batch?: { id?: string } | null }).batch?.id;
  if (batchId === undefined) throw new Error(`${scenario.name}: submission answer has no batch id`);
  const firstRequest = engine.db
    .query<{ record: string }, [string]>(
      "SELECT record FROM requests WHERE batch_id=? ORDER BY rowid LIMIT 1",
    )
    .get(batchId);
  if (firstRequest === null) throw new Error(`${scenario.name}: submitted batch has no request`);
  const newDocumentId = (JSON.parse(firstRequest.record) as { documentId: string }).documentId;
  for (const expected of followups) {
    const path = expected.path.replace("$NEW_DOCUMENT", encodeURIComponent(newDocumentId));
    const answer = await call(engine, expected.method, path, {
      as: expected.as,
      body: expected.requestBody,
    });
    expect(answer.status, `${scenario.name} ${expected.as} ${path}`).toBe(expected.status);
    expect(maskWith(await answer.json(), ids), `${scenario.name} ${path}`).toEqual(expected.body);
  }
  engine.close();
}
function scenarioNamed(prefix: string): GoldenScenario {
  const scenario = golden.scenarios.find(({ name }) => name.startsWith(prefix));
  if (scenario === undefined) throw new Error(`Missing scenario ${prefix}`);
  return scenario;
}

describe("proposal golden answers", () => {
  it("matches all non-submitting calls for every development person", async () => {
    for (const person of golden.people) {
      const engine = testEngine("base");
      const ids = new Map<string, string>();
      for (const expected of person.calls) {
        const form = expected.formPhotoSize === undefined ? undefined : new FormData();
        if (form !== undefined && expected.formPhotoSize !== undefined)
          form.append("photo", new File([new Uint8Array(expected.formPhotoSize)], "photo.jpg"));
        const answer = await call(engine, expected.method, expected.path, {
          as: person.userId,
          ...(form === undefined ? { body: expected.requestBody ?? expected.body } : { form }),
        });
        expect(answer.status, `${person.profile} ${expected.method} ${expected.path}`).toBe(
          expected.status,
        );
        expect(maskWith(await answer.json(), ids), `${person.profile} ${expected.path}`).toEqual(
          expected.body,
        );
      }
      engine.close();
    }
  });

  it("scenario a: reader submission is visible to admin requests and the reader's documents", async () => {
    await replayScenario(scenarioNamed("a-"));
  });

  it("scenario b: admin approve-now submission appears in document detail", async () => {
    await replayScenario(scenarioNamed("b-"));
  });

  it("scenario c: project proposal is visible in the member's custody", async () => {
    await replayScenario(scenarioNamed("c-"));
  });
});
