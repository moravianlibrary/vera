// biome-ignore-all lint/suspicious/noExplicitAny: rows are parsed by the status log schema.
import { eventEntrySchema } from "@vera/domain/events";

export function addHistory(
  requests: any[],
  iterations: any[],
  lists: any[],
  batches: any[],
  staff: string[],
  now: string,
  decisionByRequest: Map<string, any>,
) {
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const membersByList = new Map<string, any[]>();
  for (const iteration of iterations)
    if (iteration.listId)
      membersByList.set(iteration.listId, [
        ...(membersByList.get(iteration.listId) ?? []),
        iteration,
      ]);
  const rows: any[] = [];
  let id = 1;
  const add = (
    subjectKind: string,
    subjectId: string,
    at: string | null,
    actor: any,
    correlationId: string,
    code: string,
    data: any,
    internal: string | null = null,
  ) => {
    if (!at || Date.parse(at) > Date.parse(now)) return;
    rows.push(
      eventEntrySchema.parse({
        id: `V-E${id++}`,
        subjectKind,
        subjectId,
        at,
        actor,
        correlationId,
        code,
        data,
        reason: { public: null, internal },
      }),
    );
  };
  for (const request of requests) {
    const proposalCorrelation = `V-C-${request.id}-proposal`;
    add(
      "request",
      request.id,
      request.at,
      { kind: "user", userId: request.requesterId },
      proposalCorrelation,
      "request.created",
      {
        batch: batchById.has(request.batchId)
          ? { id: request.batchId, name: batchById.get(request.batchId).name ?? request.batchId }
          : null,
        source: null,
      },
    );
    if (request.decision === "Denied") {
      add(
        "request",
        request.id,
        request.decline.at,
        { kind: "user", userId: request.decline.actorId },
        `V-C-${request.id}-decision`,
        "request.declined",
        { batchSize: null },
        request.decline.internalText,
      );
    } else if (request.decision === "Approved") {
      const meta = decisionByRequest.get(request.id) ?? {
        at: request.at,
        actorId: staff[0] ?? "vu1",
      };
      const correlation = `V-C-${request.id}-decision`;
      add(
        "request",
        request.id,
        meta.at,
        { kind: "user", userId: meta.actorId ?? staff[0] ?? "vu1" },
        correlation,
        "request.approved",
        {
          iterationId: request.iteration?.id ?? request.id,
          isRescan: Boolean(request.rescan),
          batchSize: null,
        },
      );
      if (request.existingCopies?.length && request.iteration?.relation === "Tracks")
        add("request", request.id, meta.at, { kind: "system" }, correlation, "request.held", {
          why: "copy_exists",
        });
    }
  }
  for (const iteration of iterations) {
    const request = requestById.get(iteration.requestId);
    if (request?.decision === "Duplicate") continue;
    const meta = decisionByRequest.get(request?.id) ?? {
      at: request?.at ?? iteration.digitizedAt,
      actorId: staff[0] ?? "vu1",
    };
    const correlation = `V-C-${request?.id ?? iteration.id}-decision`;
    add(
      "iteration",
      iteration.id,
      meta.at,
      { kind: "user", userId: meta.actorId ?? staff[0] ?? "vu1" },
      correlation,
      "iteration.ingested",
      {},
    );
    for (const verdict of iteration.verdicts)
      add(
        "iteration",
        iteration.id,
        verdict.at,
        { kind: "user", userId: verdict.actorId },
        `V-C-${iteration.id}-validation-${verdict.at}`,
        "iteration.verdict_accepted",
        { defects: [] },
        verdict.note,
      );
    if (iteration.progress === "Published") {
      const link = iteration.links.find((item: any) => item.isPrimary) ?? iteration.links[0];
      const digitizer = link?.setBy ?? staff[0] ?? "vu1";
      add(
        "iteration",
        iteration.id,
        iteration.digitizedAt,
        { kind: "user", userId: digitizer },
        `V-C-${iteration.id}-digitized`,
        "iteration.digitized",
        { list: null },
      );
      if (link)
        add(
          "iteration",
          iteration.id,
          link.setAt,
          { kind: "user", userId: link.setBy },
          `V-C-${iteration.id}-published`,
          "iteration.published",
          { link: { id: link.id, url: link.url ?? `https://example.org/${link.id}` } },
        );
    }
  }
  for (const list of lists) {
    const correlation = `V-C-${list.id}`;
    add(
      "list",
      list.id,
      list.createdAt,
      { kind: "user", userId: list.createdBy },
      correlation,
      "list.created",
      { generator: null, members: membersByList.get(list.id)?.length ?? 0 },
    );
    const members = membersByList.get(list.id) ?? [];
    if (members.length)
      add(
        "list",
        list.id,
        list.createdAt,
        { kind: "user", userId: list.createdBy },
        correlation,
        "list.members_changed",
        { added: members.map((member) => member.id), removed: [] },
      );
  }
  return rows.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
