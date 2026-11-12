// Persist the writes a shared record plan made, in the act's transaction.

import type { DecisionWrites } from "@vera/contract/queries/decisions";
import type { SubmissionWrites } from "@vera/contract/queries/proposals";
import type { EventEntryInput } from "@vera/domain/events";
import type { Engine } from "../engine";
import { recordEvent } from "../events";

type Writes = DecisionWrites | SubmissionWrites;

export function writePlan(engine: Engine, writes: Writes, requests: "insert" | "replace"): void {
  for (const iteration of writes.iterations)
    engine.db
      .query("INSERT INTO iterations (id,document_id,record) VALUES (?,?,?)")
      .run(iteration.id, iteration.documentId, JSON.stringify(iteration));
  for (const request of writes.requests) {
    if (requests === "insert") {
      engine.db
        .query("INSERT INTO requests (id,document_id,batch_id,record) VALUES (?,?,?,?)")
        .run(request.id, request.documentId, request.batchId, JSON.stringify(request));
      continue;
    }
    const result = engine.db
      .query("UPDATE requests SET record = ? WHERE id = ?")
      .run(JSON.stringify(request), request.id);
    if (result.changes !== 1) throw new Error(`Planned request ${request.id} does not exist`);
  }
  for (const event of writes.events) recordPlannedEvent(engine, event);
}

function recordPlannedEvent(engine: Engine, event: EventEntryInput): void {
  switch (event.code) {
    case "request.created":
    case "request.held":
    case "request.approved":
    case "request.declined":
    case "request.withdrawn":
      if (event.data === null) throw new Error(`${event.code} needs event data`);
      recordEvent(engine, { ...event, subjectKind: "request", data: event.data, at: event.at });
      break;
    default:
      throw new Error(`Record plan produced unexpected event ${event.code}`);
  }
}
