import type { Iteration, Request, StatusLogEntry } from "./entities";
import type { RecordStore } from "./store";

type DocumentIndex<Value> = { values: Map<string, Value[]> };
const iterations = new WeakMap<readonly Iteration[], DocumentIndex<Iteration>>();
const requests = new WeakMap<readonly Request[], DocumentIndex<Request>>();
const statusEntries = new WeakMap<
  readonly StatusLogEntry[],
  { values: Map<string, StatusLogEntry[]>; positions: Map<StatusLogEntry, number> }
>();

function groupedByDocument<Value extends { documentId: string }>(
  records: readonly Value[],
  cache: WeakMap<readonly Value[], DocumentIndex<Value>>,
): Map<string, Value[]> {
  let index = cache.get(records);
  if (!index) {
    const values = new Map<string, Value[]>();
    for (const record of records) {
      const matches = values.get(record.documentId);
      if (matches) matches.push(record);
      else values.set(record.documentId, [record]);
    }
    index = { values };
    cache.set(records, index);
  }
  return index.values;
}

// RecordStore snapshot arrays can key this derived index; see store.ts.
export function iterationsByDocumentOf(store: RecordStore): Map<string, Iteration[]> {
  return groupedByDocument(store.iterations, iterations);
}

// RecordStore snapshot arrays can key this derived index; see store.ts.
export function requestsByDocumentOf(store: RecordStore): Map<string, Request[]> {
  return groupedByDocument(store.requests, requests);
}

export function statusLogBySubjectOf(store: RecordStore): Map<string, StatusLogEntry[]> {
  const records = store.statusLog;
  let index = statusEntries.get(records);
  if (!index) {
    const values = new Map<string, StatusLogEntry[]>();
    const positions = new Map<StatusLogEntry, number>();
    records.forEach((record, position) => {
      positions.set(record, position);
      const matches = values.get(record.subjectId);
      if (matches) matches.push(record);
      else values.set(record.subjectId, [record]);
    });
    index = { values, positions };
    statusEntries.set(records, index);
  }
  return index.values;
}

export function statusLogForSubjectsOf(
  store: RecordStore,
  subjects: ReadonlySet<string>,
): StatusLogEntry[] {
  const indexed = statusLogBySubjectOf(store);
  const positionIndex = statusEntries.get(store.statusLog);
  const entries = [...subjects].flatMap((subject) => indexed.get(subject) ?? []);
  return entries.toSorted(
    (first, second) =>
      second.at.localeCompare(first.at) ||
      (positionIndex?.positions.get(first) ?? 0) - (positionIndex?.positions.get(second) ?? 0),
  );
}
