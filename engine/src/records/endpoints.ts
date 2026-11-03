import {
  parseDocumentGrouping,
  parseDocumentSearchParams,
  parseDocumentSliceParams,
} from "@vera/contract/documents";
import { endpoints } from "@vera/contract/endpoints";
import { findDocumentDetail, queryDocuments } from "@vera/contract/queries/documents";
import {
  canReadRequests,
  findRequestDetail,
  publicCustodyOf,
  queryRequests,
} from "@vera/contract/queries/requests";
import {
  parseRequestGrouping,
  parseRequestSearchParams,
  parseRequestSliceParams,
} from "@vera/contract/requests";
import { servedBatches } from "@vera/domain/batches";
import { canOpenMyDocuments } from "@vera/domain/permissions";
import { requireCaller } from "../access/index";
import { implement } from "../http/endpoint";
import { problem } from "../http/problem";
import { engineRequestPlugins } from "./plugins";
import { engineStore } from "./store";

const paramsOf = (query: Record<string, string | undefined>) =>
  new URLSearchParams(
    Object.entries(query).flatMap(([k, v]) =>
      v === undefined ? [] : [[k, v] as [string, string]],
    ),
  );
const mayNotReadRequests = () => problem(403, "You may not read requests");
const forbidden = () => problem(403, "You may not open My Documents");

export const recordEndpoints = [
  implement(endpoints.documents, ({ engine, caller, query }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const { session } = auth;
    const params = paramsOf(query as Record<string, string | undefined>),
      mine = params.get("perspective") === "my";
    if (mine && !canOpenMyDocuments(session)) return forbidden();
    return {
      body: queryDocuments(
        engineStore(engine),
        session,
        parseDocumentSearchParams(params),
        parseDocumentSliceParams(params),
        parseDocumentGrouping(params),
        mine ? "public" : undefined,
      ),
    };
  }),
  implement(endpoints.documentDetail, ({ engine, caller, params, query }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const { session } = auth;
    const mine = query.perspective === "my";
    if (mine && !canOpenMyDocuments(session)) return forbidden();
    const detail = findDocumentDetail(
      engineStore(engine),
      session,
      params.documentId,
      mine ? "public" : undefined,
    );
    return detail === null ? problem(404, "Document not found") : { body: detail };
  }),
  implement(endpoints.requests, ({ engine, caller, query }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const { session } = auth;
    if (!canReadRequests(session)) return mayNotReadRequests();
    const params = paramsOf(query as Record<string, string | undefined>),
      store = engineStore(engine);
    return {
      body: queryRequests(
        store,
        engineRequestPlugins(engine),
        session,
        parseRequestSearchParams(params),
        parseRequestSliceParams(params),
        parseRequestGrouping(params),
      ),
    };
  }),
  implement(endpoints.requestDetail, ({ engine, caller, params }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const { session } = auth;
    if (!canReadRequests(session)) return mayNotReadRequests();
    const detail = findRequestDetail(
      engineStore(engine),
      engineRequestPlugins(engine),
      session,
      params.documentId,
    );
    return detail === null ? problem(404, "Request not found") : { body: detail };
  }),
  implement(endpoints.requestCustodies, ({ engine, caller }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const { session } = auth;
    if (!canReadRequests(session)) return mayNotReadRequests();
    return {
      body: engineStore(engine).requestCustodies.map(publicCustodyOf),
    };
  }),
  implement(endpoints.batches, ({ engine, caller }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    return { body: servedBatches(engineStore(engine)) };
  }),
];
