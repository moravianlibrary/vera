// PLG-api-kinds and PLG-api-outcome: every operation has a parseable example and a closed refusal list.
import { describe, expect, it } from "bun:test";
import * as api from "./plugin-api";
import { pluginRefusalSchemas, pluginRefusedSchemas } from "./plugin-api/outcome";

const record = {
  id: "d1",
  catalogId: "c1",
  unit: null,
  title: "Title",
  type: "Monograph",
  shelfMark: null,
  pageSources: [],
  registryRecords: [],
  properties: [],
};
const iteration = {
  id: "i1",
  documentId: "d1",
  attempt: 1,
  requestId: "r1",
  categoryId: "c1",
  priority: "Normal",
  projectId: null,
  progress: "Enqueued",
  listId: null,
  formerListName: null,
  restriction: null,
  restrictionOverride: null,
  cancellation: null,
  defects: [],
  verdicts: [],
  ingestFailure: null,
  digitizedAt: null,
  links: [],
  scanDpi: null,
  properties: [],
};
const request = {
  id: "r1",
  documentId: "d1",
  requesterId: "u1",
  at: "2026-01-01T00:00:00Z",
  reason: null,
  batchId: "b1",
  projectId: null,
  existingCopies: [],
  checkedAt: null,
  decision: "Pending",
  isAfterProjectApproval: false,
};
const intention = {
  id: "n1",
  name: "All",
  description: "",
  funding: { kind: "any" },
  projectId: null,
  scopeCategoryId: null,
  distributionId: null,
  targetPages: null,
  countsFrom: "2026-01-01",
  endsOn: null,
  isOverall: true,
  templateId: null,
  archived: null,
};
const mix = { revision: 1, shares: {}, at: "2026-01-01T00:00:00Z", label: null };
const examples: [string, unknown, unknown][] = [
  ["begin", { returnTo: "/" }, { redirect: null }],
  [
    "complete",
    { username: "reader", password: "secret" },
    { externalId: "r1", email: null, emailVerified: false, name: "Reader", claims: [] },
  ],
  ["readBarcode", { photo: "base64" }, { value: null }],
  ["readPhoto", { photo: "base64" }, { seen: "cover", values: [], candidates: [] }],
  [
    "entry",
    { parameters: {}, page: "https://portal.example/" },
    { item: null, origin: "https://portal.example/" },
  ],
  ["recognise", { value: "123" }, { recognised: true, normalForm: "123" }],
  ["harvest", { cursor: null }, { items: [], nextCursor: null }],
  [
    "read",
    { catalogId: "c1" },
    {
      catalogId: "c1",
      fields: {},
      units: null,
      issuanceType: "Monograph",
      readAt: "2026-01-01T00:00:00Z",
    },
  ],
  ["readLink", { pasted: "c1" }, { catalogId: "c1" }],
  ["search", { query: "title" }, { hits: [] }],
  ["changes", { cursor: null }, { catalogIds: [], nextCursor: null }],
  ["sync", { cursor: null }, { keep: [], drop: [], nextCursor: null, hasMore: false }],
  ["values", { record, iteration }, { values: [] }],
  ["lookup", { record, identifiers: [] }, { records: [] }],
  ["validationCheck", { record, properties: [] }, { defects: [] }],
  ["restrictionCheck", { record, properties: [] }, { findings: [] }],
  ["place", { request, document: record }, { custodies: [] }],
  ["suggest", { request, document: record }, null],
  ["generate", { intention, mix, pool: [iteration], pageBudget: 1 }, { picked: [], shortBy: 0 }],
  ["canonical", { pasted: "pid" }, { url: "https://example.org/item", location: "record" }],
  ["detect", { iterations: [] }, { links: [] }],
  [
    "handOff",
    { recipients: ["a@example.org"], subject: "s", text: "t" },
    { address: null, sent: false },
  ],
  ["send", { recipient: "a@example.org", payload: {} }, { sent: true }],
  ["test", { recipient: "a@example.org" }, { sent: true, elapsedMs: 1 }],
];

describe("plugin API types", () => {
  it("parses example inputs and answers for every operation", () => {
    for (const [operation, input, answer] of examples) {
      const inputSchema = (
        api as unknown as Record<string, { safeParse(value: unknown): unknown }>
      )[
        `${operation === "validationCheck" ? "validationCheck" : operation === "restrictionCheck" ? "restrictionCheck" : operation}InputSchema`
      ];
      const answerSchema = (
        api as unknown as Record<string, { safeParse(value: unknown): unknown }>
      )[
        `${operation === "validationCheck" ? "validationCheck" : operation === "restrictionCheck" ? "restrictionCheck" : operation}AnswerSchema`
      ];
      expect(inputSchema?.safeParse(input), operation).toHaveProperty("success", true);
      expect(answerSchema?.safeParse(answer), operation).toHaveProperty("success", true);
    }
  });

  it("rejects refusal codes outside each kind's closed list", () => {
    for (const [kind, schema] of Object.entries(pluginRefusalSchemas)) {
      expect(schema.safeParse("not_a_refusal"), kind).toHaveProperty("success", false);
      expect(
        (pluginRefusedSchemas as Record<string, { safeParse(value: unknown): unknown }>)[
          kind
        ]?.safeParse({
          kind: "refused",
          pluginKind: kind,
          code: "not_a_refusal",
          message: "No",
        }),
        kind,
      ).toHaveProperty("success", false);
    }
  });
});
