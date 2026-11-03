// Serve proposal decisions by writing the shared plan and its history as one act.

import { endpoints } from "@vera/contract/endpoints";
import {
  planApproval,
  planBulkApproval,
  planDecline,
  planWithdrawal,
} from "@vera/contract/queries/decisions";
import type { QueryOutcome } from "@vera/contract/queries/outcome";
import type { RefusalCode } from "@vera/contract/refusal-codes";
import { hasPermission } from "@vera/domain/permissions";
import { requireCaller } from "../access/index";
import type { Engine } from "../engine";
import { implement } from "../http/endpoint";
import { problem } from "../http/problem";
import { engineRequestPlugins } from "./plugins";
import { engineStore } from "./store";
import { writePlan } from "./write";

function outcomeResponse<Value>(
  engine: Engine,
  outcome: QueryOutcome<{
    writes: import("@vera/contract/queries/decisions").DecisionWrites;
    result: Value;
  }>,
) {
  if ("refusal" in outcome)
    return problem(
      outcome.refusal.status,
      outcome.refusal.message,
      outcome.refusal.code === undefined
        ? {}
        : { code: outcome.refusal.code satisfies RefusalCode },
    );
  engine.db.transaction(() => writePlan(engine, outcome.value.writes, "replace"))();
  return { body: outcome.value.result };
}

export const decisionEndpoints = [
  implement(endpoints.batchApprove, ({ engine, caller, params, body }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    if (!hasPermission(auth.session, "request.decide"))
      return problem(403, "You may not decide proposals");
    return outcomeResponse(
      engine,
      planBulkApproval(
        engineStore(engine),
        engineRequestPlugins(engine),
        auth.session,
        params.batchId,
        body,
        engine.clock.now(),
        (prefix) => `${prefix}-${crypto.randomUUID()}`,
      ),
    );
  }),
  implement(endpoints.requestApprove, ({ engine, caller, params, body }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    if (!hasPermission(auth.session, "request.decide"))
      return problem(403, "You may not decide proposals");
    return outcomeResponse(
      engine,
      planApproval(
        engineStore(engine),
        engineRequestPlugins(engine),
        auth.session,
        params.documentId,
        body,
        engine.clock.now(),
        (prefix) => `${prefix}-${crypto.randomUUID()}`,
      ),
    );
  }),
  implement(endpoints.requestDecline, ({ engine, caller, params, body }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    if (!hasPermission(auth.session, "request.decide"))
      return problem(403, "You may not decide proposals");
    return outcomeResponse(
      engine,
      planDecline(
        engineStore(engine),
        engineRequestPlugins(engine),
        auth.session,
        params.documentId,
        body,
        engine.clock.now(),
      ),
    );
  }),
  implement(endpoints.requestWithdraw, ({ engine, caller, params }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    return outcomeResponse(
      engine,
      planWithdrawal(engineStore(engine), auth.session, params.documentId, engine.clock.now()),
    );
  }),
];
