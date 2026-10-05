// Volume for the mock: copies of the fixture documents with everything behind them, so lists
// can be tried at thousands of rows. Copy n of a record gets the ID suffix `.n`, and a copied
// document a catalog ID of its own so identifier search still finds one record.

import type { Document, Iteration, Request, StatusLogEntry } from "@/domain/entities";

interface Records {
  documents: readonly Document[];
  iterations: readonly Iteration[];
  requests: readonly Request[];
  statusLog: readonly StatusLogEntry[];
}

// The fixtures plus `copies - 1` copies of them; one copy is the fixtures alone.
export function withCopies(records: Records, copies: number): Records {
  const copyNumbers = Array.from({ length: Math.max(copies, 1) - 1 }, (_, index) => index + 2);
  const copied = copyNumbers.map((copy) => copyOf(records, copy));
  return {
    documents: [...records.documents, ...copied.flatMap((entry) => entry.documents)],
    iterations: [...records.iterations, ...copied.flatMap((entry) => entry.iterations)],
    requests: [...records.requests, ...copied.flatMap((entry) => entry.requests)],
    statusLog: [...records.statusLog, ...copied.flatMap((entry) => entry.statusLog)],
  };
}

function copyOf(records: Records, copy: number): Records {
  const suffixed = (id: string) => `${id}.${copy}`;
  const nullableSuffixed = (id: string | null) => (id === null ? null : suffixed(id));
  const copiedSubjects = new Set([...records.iterations, ...records.requests].map(({ id }) => id));

  return {
    documents: records.documents.map((document) => ({
      ...document,
      id: suffixed(document.id),
      catalogId: copiedCatalogId(document.catalogId, copy),
      title: `${document.title} (${copy})`,
    })),
    iterations: records.iterations.map((iteration) => ({
      ...iteration,
      id: suffixed(iteration.id),
      documentId: suffixed(iteration.documentId),
      requestId: suffixed(iteration.requestId),
    })),
    requests: records.requests.map((request) => copiedRequest(request, suffixed, nullableSuffixed)),
    statusLog: records.statusLog.map((entry) => ({
      ...entry,
      id: suffixed(entry.id),
      subjectId: copiedSubjects.has(entry.subjectId) ? suffixed(entry.subjectId) : entry.subjectId,
    })),
  };
}

function copiedRequest(
  request: Request,
  suffixed: (id: string) => string,
  nullableSuffixed: (id: string | null) => string | null,
): Request {
  const base = {
    id: suffixed(request.id),
    documentId: suffixed(request.documentId),
    existingCopies: request.existingCopies.map((existing) => ({
      ...existing,
      iterationId: nullableSuffixed(existing.iterationId),
    })),
  };

  if (request.decision === "Approved") {
    return {
      ...request,
      ...base,
      iteration: request.iteration && { ...request.iteration, id: suffixed(request.iteration.id) },
    };
  }

  if (request.decision === "Duplicate") {
    return { ...request, ...base, tracksIterationId: suffixed(request.tracksIterationId) };
  }

  return { ...request, ...base };
}

// The record number's last digits carry the copy, so `MZK01-001284756` becomes `MZK01-0012847xx`.
function copiedCatalogId(catalogId: string, copy: number): string {
  const digits = String(copy).padStart(3, "0");
  return `${catalogId.slice(0, -digits.length)}${digits}`;
}
