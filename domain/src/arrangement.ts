// How the mock arranges a list: rows grouped by a key, each group's header counted over every
// matching row, and the list served a slice at a time. Shared by every list resource.

export interface Arrangement<Row, Header> {
  // The rows in group order, the list's own order kept within a group.
  sorted: (rows: readonly Row[]) => Row[];
  // The headers of the groups a slice's rows fall into, counted over every matching row.
  headersOf: (items: readonly Row[], matching: readonly Row[]) => Header[];
}

// Groups by a key in the given order; a null key, or one not in the order, comes last.
export function groupedBy<Row, Header>(
  keyOf: (row: Row) => string | null,
  order: readonly string[],
  headerOf: (key: string | null, total: number, rowCount: number) => Header,
): Arrangement<Row, Header> {
  const knownKeyOf = (row: Row) => {
    const key = keyOf(row);
    return key !== null && order.includes(key) ? key : null;
  };
  const rankOf = (row: Row) => {
    const key = knownKeyOf(row);
    return key === null ? order.length : order.indexOf(key);
  };

  return {
    sorted: (rows) => rows.toSorted((first, second) => rankOf(first) - rankOf(second)),
    headersOf: (items, matching) => {
      const runs: { key: string | null; rowCount: number }[] = [];
      for (const key of items.map(knownKeyOf)) {
        const last = runs.at(-1);
        if (last !== undefined && last.key === key) {
          last.rowCount += 1;
          continue;
        }

        runs.push({ key, rowCount: 1 });
      }

      return runs.map(({ key, rowCount }) =>
        headerOf(key, matching.filter((row) => knownKeyOf(row) === key).length, rowCount),
      );
    },
  };
}

// The mock's cursor is the last row's ID. A real server encodes that row's sort key instead, so
// a row that changes or leaves meanwhile does not lose the reader's place.
export function sliceOf<Row>(
  rows: readonly Row[],
  idOf: (row: Row) => string,
  { cursor, limit }: { cursor: string | null; limit: number },
): { items: Row[]; nextCursor: string | null } {
  const start = cursor === null ? 0 : rows.findIndex((row) => idOf(row) === cursor) + 1;
  if (cursor !== null && start === 0) {
    return { items: [], nextCursor: null };
  }

  const items = rows.slice(start, start + limit);
  const last = items.at(-1);
  const hasMore = start + limit < rows.length;
  return { items, nextCursor: hasMore && last !== undefined ? idOf(last) : null };
}

export function countValues(values: readonly string[]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts].map(([value, count]) => ({ value, count }));
}
