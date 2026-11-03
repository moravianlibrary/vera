// Proposal endpoints use the shared checks and plan, then persist the plan as one act.

import { endpoints } from "@vera/contract/endpoints";
import {
  canSubmitRateLimited,
  checkItem,
  getRateLimitStatus,
  planSubmission,
  proposableProjectsOf,
  proposalLimitOf,
  proposalSettingsOf,
  submittableProposalItemCount,
} from "@vera/contract/queries/proposals";
import type { WayInOutcome } from "@vera/contract/queries/ways-in";
import {
  barcodeAt,
  readPhoto,
  readRecordLink,
  searchCatalogs,
} from "@vera/contract/queries/ways-in";
import type { RefusalCode } from "@vera/contract/refusal-codes";
import type { EventEntryInput } from "@vera/domain/events";
import { hasPermission } from "@vera/domain/permissions";
import { requireCaller } from "../access/index";
import type { Engine } from "../engine";
import { recordEvent } from "../events";
import { implement } from "../http/endpoint";
import { problem } from "../http/problem";
import { engineProposalContext, engineProposalPlugins } from "./plugins";
import { engineStore } from "./store";

const barcodeCounts = new WeakMap<Engine, number>();
const forbidden = (message = "You may not propose") => problem(403, message);

function wayInResponse<Value>(outcome: WayInOutcome<Value>) {
  if ("value" in outcome) return { body: outcome.value };
  return problem(
    outcome.refusal.status,
    outcome.refusal.message,
    "code" in outcome.refusal ? { code: outcome.refusal.code satisfies RefusalCode } : {},
  );
}

function recordPlannedEvent(engine: Engine, event: EventEntryInput): void {
  if (event.code === "request.created") {
    if (event.data === null) throw new Error("request.created needs event data");
    recordEvent(engine, {
      ...event,
      subjectKind: "request",
      data: event.data,
      at: event.at,
    });
  } else if (event.code === "request.approved") {
    if (event.data === null) throw new Error("request.approved needs event data");
    recordEvent(engine, {
      ...event,
      subjectKind: "request",
      data: event.data,
      at: event.at,
    });
  } else {
    throw new Error(`Proposal plan produced unexpected event ${event.code}`);
  }
}

export const proposalEndpoints = [
  implement(endpoints.proposalSettings, ({ engine, caller }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    return {
      body: proposalSettingsOf(engineStore(engine), engineProposalPlugins(engine), auth.session),
    };
  }),
  implement(endpoints.proposalRateLimit, ({ engine, caller }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    return { body: getRateLimitStatus(engineStore(engine), auth.session, engine.clock.now()) };
  }),
  implement(endpoints.proposalLookup, ({ engine, caller, body }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    if (!hasPermission(auth.session, "request.create")) return forbidden();
    const store = engineStore(engine),
      plugins = engineProposalPlugins(engine);
    return { body: body.items.map((item) => checkItem(store, plugins, auth.session, item)) };
  }),
  implement(endpoints.proposalCatalogSearch, ({ engine, caller, query }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    if (!hasPermission(auth.session, "request.create")) return forbidden();
    const { plugins, tables } = engineProposalContext(engine);
    return {
      body: searchCatalogs(
        query.q ?? "",
        query.catalog ?? null,
        tables.instances,
        tables.implementations,
        tables.catalogs,
        plugins.catalogRecords(),
      ),
    };
  }),
  implement(endpoints.proposalRecordLink, ({ engine, caller, body }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    if (!hasPermission(auth.session, "request.create")) return forbidden();
    const { tables } = engineProposalContext(engine);
    return wayInResponse(
      readRecordLink(body, tables.instances, tables.implementations, tables.catalogs),
    );
  }),
  implement(endpoints.proposalPhoto, async ({ engine, caller, request }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    if (!hasPermission(auth.session, "request.create")) return forbidden();
    const file = (await request.formData()).get("photo");
    if (!(file instanceof File))
      return problem(422, "Take a photo to read", { code: "proposal.photo_missing" });
    const { tables, photo, records } = engineProposalContext(engine);
    return wayInResponse(readPhoto(tables.instances, tables.implementations, records, photo));
  }),
  implement(endpoints.proposalBarcode, async ({ engine, caller, request }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    if (!hasPermission(auth.session, "request.create")) return forbidden();
    const file = (await request.formData()).get("photo");
    if (!(file instanceof File))
      return problem(422, "Photograph a barcode to read", { code: "proposal.photo_missing" });
    const { tables, records } = engineProposalContext(engine);
    const count = barcodeCounts.get(engine) ?? 0;
    const result = barcodeAt(records, count, file.size, tables.instances, tables.implementations);
    if (file.size > 0 && "value" in result) barcodeCounts.set(engine, count + 1);
    return wayInResponse(result);
  }),
  implement(endpoints.proposals, ({ engine, caller, body }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const { session } = auth;
    if (
      !hasPermission(session, "request.create") ||
      (body.approval !== null && !hasPermission(session, "request.decide"))
    )
      return forbidden("You may not propose this");
    const store = engineStore(engine),
      plugins = engineProposalPlugins(engine);
    const limit = proposalLimitOf(store, session);
    if (limit !== null && body.items.length > limit)
      return problem(422, `At most ${limit} items at once`, { code: "proposal.too_many_items" });
    const now = engine.clock.now();
    if (
      !canSubmitRateLimited(
        store,
        session,
        submittableProposalItemCount(store, plugins, session, body),
        now,
      )
    )
      return problem(429, "Today's proposal limit has been reached", {
        code: "proposal.daily_limit",
      });
    if (
      body.projectId !== null &&
      !proposableProjectsOf(store, session).some((project) => project.id === body.projectId)
    )
      return problem(422, "Only a member proposes into a project, and not into a rejected one", {
        code: "project.not_proposable",
      });
    const { writes, report } = planSubmission(
      store,
      plugins,
      session,
      body,
      now,
      (prefix) => `${prefix}-${crypto.randomUUID()}`,
    );
    engine.db.transaction(() => {
      if (writes.batch)
        engine.db
          .query("INSERT INTO batches (id,record) VALUES (?,?)")
          .run(writes.batch.id, JSON.stringify(writes.batch));
      for (const record of writes.documents)
        engine.db
          .query("INSERT INTO documents (id,record) VALUES (?,?)")
          .run(record.id, JSON.stringify(record));
      for (const record of writes.iterations)
        engine.db
          .query("INSERT INTO iterations (id,document_id,record) VALUES (?,?,?)")
          .run(record.id, record.documentId, JSON.stringify(record));
      for (const record of writes.requests)
        engine.db
          .query("INSERT INTO requests (id,document_id,batch_id,record) VALUES (?,?,?,?)")
          .run(record.id, record.documentId, record.batchId, JSON.stringify(record));
      for (const event of writes.events) recordPlannedEvent(engine, event);
    })();
    return { status: 201, body: report };
  }),
];
