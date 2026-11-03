import { afterAll, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { endpoints } from "@vera/contract/endpoints";
import { endpointOf } from "./endpoints";
import { knownGaps } from "./known-gaps";
import { startLocalEngine } from "./local-engine";
import { mask } from "./mask";
import { type Recording, type RecordingCall, recordingSchema } from "./recording";

const local = process.env.VERA_API_URL === undefined ? startLocalEngine() : undefined;
const baseUrl = process.env.VERA_API_URL?.replace(/\/$/, "") ?? local?.url;
if (baseUrl === undefined) throw new Error("Could not resolve the API base URL");
afterAll(() => local?.stop());

const files = readdirSync(join(import.meta.dir, "../recordings"))
  .filter((file) => file.endsWith(".json"))
  .sort();
const recordings = files.map((file) => ({
  file,
  recording: recordingSchema.parse(
    JSON.parse(readFileSync(join(import.meta.dir, "../recordings", file), "utf8")),
  ) as Recording,
}));

function unsupported(scenario: Recording["scenarios"][number]) {
  return scenario.calls.find((call) => {
    const name = endpointOf(call);
    return name !== undefined && endpoints[name].engine === false;
  });
}

function knownGap(file: string, scenario: Recording["scenarios"][number]) {
  return knownGaps.find((gap) => gap.recording === file && gap.scenario === scenario.name);
}

async function postJson(path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function sendCall(call: RecordingCall): Promise<Response> {
  const headers = new Headers();
  if (call.as !== undefined) {
    const opened = await postJson("/_engine/sessions", { userId: call.as });
    if (opened.status === 200) {
      const cookie = opened.headers.get("Set-Cookie") ?? "";
      const token = /(?:^|,\s*)vera_session=([^;,]*)/.exec(cookie)?.[1];
      if (token) headers.set("Cookie", `vera_session=${token}`);
    }
  }

  let body: BodyInit | undefined;
  if (call.form !== undefined) {
    const form = new FormData();
    for (const [field, value] of Object.entries(call.form)) {
      if (typeof value === "string") form.append(field, value);
      else form.append(field, new File([new Uint8Array(value.photoBytes)], "photo.jpg"));
    }
    body = form;
  } else if (call.requestBody !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(call.requestBody);
  }

  return fetch(`${baseUrl}${call.path}`, { method: call.method, headers, body });
}

async function replay(recording: Recording, scenario: Recording["scenarios"][number]) {
  const reset = await postJson("/_engine/reset", { seed: recording.seed, frozen: true });
  expect(reset.status, `${scenario.name}: reset status`).toBe(200);
  const resetAnswer = (await reset.json()) as { now: string };
  const resetTime = new Date(resetAnswer.now).getTime();
  const recordingTime = new Date(recording.moment).getTime();
  if (recordingTime < resetTime)
    throw new Error(
      `${scenario.name}: recording moment ${recording.moment} is earlier than reset now ${resetAnswer.now}`,
    );
  if (recordingTime !== resetTime) {
    const clock = await postJson("/_engine/clock", { at: recording.moment });
    expect(clock.status, `${scenario.name}: set clock`).toBe(200);
  }

  const ids = new Map<string, string>();
  const submission = scenario.calls.find(
    (call) => call.method === "POST" && call.path === "/api/proposals",
  );
  const proposalItems = (
    submission?.requestBody as
      | { items?: Array<{ value?: string; unit?: string | null }> }
      | undefined
  )?.items;
  let submittedBatchId: string | undefined;
  for (const call of scenario.calls) {
    let path = call.path;
    if (path.includes("$NEW_DOCUMENT")) {
      const catalogId = proposalItems?.[0]?.value;
      const unit = proposalItems?.[0]?.unit ?? null;
      if (catalogId === undefined)
        throw new Error(`${scenario.name}: no proposal item for $NEW_DOCUMENT`);
      if (submittedBatchId === undefined)
        throw new Error(`${scenario.name}: no submitted batch for $NEW_DOCUMENT`);
      // Pending proposals appear in requests; approve-now proposals have already moved to documents.
      const requestsPage = await sendCall({
        method: "GET",
        path: `/api/requests?q=${encodeURIComponent(catalogId)}`,
        as: call.as,
        status: 200,
      });
      expect(requestsPage.status, `${scenario.name}: find submitted request`).toBe(200);
      const requestsResult = (await requestsPage.json()) as {
        items?: Array<{
          record?: {
            document?: { id?: string; catalogId?: string; unit?: { value?: string } | null };
            requests?: Array<{ batchId?: string }>;
          };
        }>;
      };
      let documentId = requestsResult.items?.find(
        (item) =>
          item.record?.document?.catalogId === catalogId &&
          (item.record.document.unit?.value ?? null) === unit &&
          item.record.requests?.some((request) => request.batchId === submittedBatchId),
      )?.record?.document?.id;
      if (documentId === undefined) {
        const page = await sendCall({
          method: "GET",
          path: `/api/documents?q=${encodeURIComponent(catalogId)}`,
          as: call.as,
          status: 200,
        });
        expect(page.status, `${scenario.name}: find submitted document`).toBe(200);
        const result = (await page.json()) as {
          items?: Array<{
            document?: { id?: string; catalogId?: string; unit?: { value?: string } | null };
          }>;
        };
        documentId = result.items?.find(
          (item) =>
            item.document?.catalogId === catalogId && (item.document.unit?.value ?? null) === unit,
        )?.document?.id;
      }
      if (documentId === undefined)
        throw new Error(
          `${scenario.name}: submitted document was not in /api/requests or /api/documents`,
        );
      path = path.replace("$NEW_DOCUMENT", encodeURIComponent(documentId));
    }
    const label = `${scenario.name} ${call.method} ${path}`;
    const response = await sendCall({ ...call, path });
    expect(response.status, `${label} status`).toBe(call.status);
    if (call.body !== undefined) {
      const answer = await response.json();
      if (call.method === "POST" && call.path === "/api/proposals")
        submittedBatchId = (answer as { batch?: { id?: string } | null }).batch?.id;
      expect(
        recording.mask === "none" ? answer : mask(answer, recording.mask, ids),
        `${label} body`,
      ).toEqual(call.body);
    } else if (call.code !== undefined) {
      const answer = (await response.json()) as { code?: string };
      expect(answer.code, `${label} code`).toBe(call.code);
    }
  }
}

for (const { file, recording } of recordings) {
  describe(file, () => {
    for (const scenario of recording.scenarios) {
      const gap = knownGap(file, scenario);
      const notServed = unsupported(scenario);
      if (process.env.VERA_REPLAY_ALL !== "1" && gap !== undefined) {
        it.skip(`${scenario.name} (known gap: ${gap.reason})`, () => {});
      } else if (process.env.VERA_REPLAY_ALL !== "1" && notServed !== undefined) {
        it.skip(`${scenario.name} (engine does not serve ${notServed.method} ${notServed.path})`, () => {});
      } else {
        it(scenario.name, async () => replay(recording, scenario));
      }
    }
  });
}
