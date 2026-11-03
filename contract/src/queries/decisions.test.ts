import { describe, expect, test } from "bun:test";
import type { Document, Request, Session } from "@vera/domain/entities";
import type { RecordStore } from "@vera/domain/store";
import { planApproval, planBulkApproval, planDecline, planWithdrawal } from "./decisions";
import type { RequestPlugins } from "./requests";

const time = "2026-01-01T00:00:00.000Z";
const document = (id: string): Document => ({
  id,
  catalogId: id,
  unit: null,
  title: id,
  type: "Monograph",
  shelfMark: null,
  pageSources: [],
  registryRecords: [],
  properties: [],
});
const ask = (id: string, documentId: string, requesterId = "reader"): Request => ({
  id,
  documentId,
  requesterId,
  at: time,
  reason: null,
  batchId: "b1",
  projectId: null,
  existingCopies: [],
  checkedAt: time,
  decision: "Pending",
  isAfterProjectApproval: false,
});
const session: Session = {
  user: { id: "reader", name: "Reader", kind: "person", email: null },
  roleIds: [],
  grants: [
    { permission: "request.read", scope: "any" },
    { permission: "request.decide", scope: "any" },
    { permission: "request.withdraw_own", scope: "any" },
  ],
  custodyCategoryIds: [],
  groupIds: [],
};
const plugins: RequestPlugins = { placementsOf: () => ["c1"], suggestionFor: () => null };
const approval = { categoryId: "leaf", priority: "Normal", rescanNote: null } as const;
const bulk = { ...approval, excludedIds: ["d2"] };
let sequence = 0;
const newId = (prefix: string) => `${prefix}-${++sequence}`;

function store(
  requests: Request[] = [ask("r1", "d1"), ask("r2", "d1")],
  documentIds = ["d1"],
): RecordStore {
  return {
    today: new Date(time),
    catalogPropertyKeys: new Set(),
    users: [],
    roles: [],
    groups: [],
    categories: [{ id: "leaf", name: "Leaf", parentId: null }],
    projects: [],
    batches: [{ id: "b1" }],
    requestCustodies: [
      {
        id: "c1",
        name: "Custody",
        description: "",
        isFallback: false,
        memberIds: [],
        groupIds: [],
      },
    ],
    documents: documentIds.map(document),
    iterations: [],
    requests,
    statusLog: [],
    propertyDefinitions: [],
  } as unknown as RecordStore;
}

describe("decision plans", () => {
  test("approval plans one originating iteration and shared events for both asks", () => {
    const planned = planApproval(store(), plugins, session, "d1", approval, new Date(time), newId);
    expect("value" in planned).toBe(true);
    if (!("value" in planned)) return;
    const { writes } = planned.value;
    expect(writes.iterations).toHaveLength(1);
    expect(writes.iterations[0]?.requestId).toBe("r1");
    expect(
      writes.requests.map(
        (request) => request.decision === "Approved" && request.iteration?.relation,
      ),
    ).toEqual(["Originates", "Tracks"]);
    expect(writes.events.map((event) => event.code)).toEqual([
      "request.approved",
      "request.approved",
    ]);
    expect(new Set(writes.events.map((event) => event.correlationId)).size).toBe(1);
    expect(writes.events[0]?.data).toMatchObject({ batchSize: 2 });
    expect(writes.events[0]?.reason.internal).toBeNull();
  });

  test("approval refuses outside custody, decided rows, pending checks and missing rescan notes", () => {
    const outside: Session = {
      ...session,
      grants: [
        { permission: "request.read", scope: "any" },
        { permission: "request.decide", scope: "custody" },
      ],
    };
    const outsidePlugins: RequestPlugins = { ...plugins, placementsOf: () => ["c2"] };
    expect(
      planApproval(store(), outsidePlugins, outside, "d1", approval, new Date(time), newId),
    ).toMatchObject({ refusal: { status: 403, code: "proposal.outside_request_custody" } });
    const decided = store([
      {
        ...ask("r1", "d1"),
        decision: "Denied",
        decline: { actorId: "reader", at: time, publicText: "No", internalText: null },
      } as Request,
    ]);
    expect(
      planApproval(decided, plugins, session, "d1", approval, new Date(time), newId),
    ).toMatchObject({ refusal: { status: 409, code: "proposal.decided" } });
    const checking = store([{ ...ask("r1", "d1"), checkedAt: null }]);
    expect(
      planApproval(checking, plugins, session, "d1", approval, new Date(time), newId),
    ).toMatchObject({ refusal: { status: 409, code: "proposal.checks_pending" } });
    const rescan = store([
      {
        ...ask("r1", "d1"),
        existingCopies: [
          {
            source: "A",
            state: "Digitized",
            link: null,
            iterationId: null,
            seenAt: time,
            foundAfterApproval: false,
          },
        ],
      },
    ]);
    expect(
      planApproval(rescan, plugins, session, "d1", approval, new Date(time), newId),
    ).toMatchObject({ refusal: { status: 422, code: "proposal.rescan_reason_missing" } });
  });

  test("decline records exactly the two texts supplied by the decider", () => {
    const planned = planDecline(
      store(),
      plugins,
      session,
      "d1",
      { publicText: "Public", internalText: "Internal" },
      new Date(time),
    );
    expect("value" in planned && planned.value.writes.events[0]?.reason).toEqual({
      public: "Public",
      internal: "Internal",
    });
  });

  test("withdrawal distinguishes another person's ask from the caller's pending ask", () => {
    expect(
      planWithdrawal(store([ask("r1", "d1", "someone")]), session, "d1", new Date(time)),
    ).toMatchObject({ refusal: { status: 404, code: "request.not_asked" } });
    const planned = planWithdrawal(store([ask("r1", "d1")]), session, "d1", new Date(time));
    expect("value" in planned && planned.value.writes.requests[0]?.decision).toBe("Withdrawn");
  });

  test("bulk approval plans eligible rows, skips an excluded row, and leaves the store unchanged", () => {
    const records = store([ask("r1", "d1"), ask("r2", "d2")], ["d1", "d2"]);
    const before = structuredClone(records);
    const planned = planBulkApproval(records, plugins, session, "b1", bulk, new Date(time), newId);
    expect("value" in planned && planned.value.result.approvedCount).toBe(1);
    expect("value" in planned && planned.value.writes.iterations).toHaveLength(1);
    expect(records).toEqual(before);
  });
});
