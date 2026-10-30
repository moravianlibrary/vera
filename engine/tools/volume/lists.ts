// biome-ignore-all lint/suspicious/noExplicitAny: generated rows are validated with entity schemas.
import { digitizationListSchema, iterationSchema } from "@vera/domain/entities";
import { logNormal, pick, type Random, weighted } from "./random";

const words = ["Monografie", "Periodika", "Regionální literatura", "Dary", "Mapy", "Hudebniny"];
const day = 86400000;

function weekdayTime(random: Random, year: number, month: number, maxDay: number): Date {
  for (let attempt = 0; attempt < 100; attempt++) {
    const date = new Date(
      Date.UTC(
        year,
        month,
        1 + Math.floor(random() * maxDay),
        8 + Math.floor(random() * 8),
        Math.floor(random() * 60),
      ),
    );
    if (date.getUTCDay() > 0 && date.getUTCDay() < 6) return date;
  }
  return new Date(Date.UTC(year, month, 1, 9));
}

function monthCounts(count: number): number[] {
  const weights = Array.from({ length: 17 }, (_, index) => 0.84 ** index);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const raw = weights.map((weight) => (count * weight) / totalWeight);
  const values = raw.map(Math.floor);
  const remainder = count - values.reduce((sum, value) => sum + value, 0);
  const rank = raw
    .map((value, i) => ({ i, frac: value - values[i]! }))
    .sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < remainder; i++) values[rank[i]!.i] += 1;
  return values;
}

export function addLists(
  random: Random,
  iterations: any[],
  documents: any[],
  requests: any[],
  staff: string[],
  categories: any[],
  now: string,
  scale: number,
) {
  const count = Math.max(1, Math.round(141 * scale));
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const documentById = new Map(documents.map((document) => [document.id, document]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const rootByCategory = new Map<string, string>();
  for (const category of categories) {
    let current = category;
    while (current?.parentId && current.parentId !== "vc0")
      current = categoryById.get(current.parentId);
    if (current?.parentId === "vc0") rootByCategory.set(category.id, current.id);
  }
  const byRoot = new Map<string, any[]>();
  for (const iteration of iterations) {
    const root = rootByCategory.get(iteration.categoryId);
    if (root) byRoot.set(root, [...(byRoot.get(root) ?? []), iteration]);
  }
  const monthly = monthCounts(count);
  const roots = [
    ...new Set(
      categories.filter((category) => category.parentId === "vc0").map((category) => category.id),
    ),
  ];
  const monthSpecs = monthly.flatMap((n, month) => Array.from({ length: n }, () => month));
  const emptyIndexes = new Set<number>();
  const emptyTarget = Math.min(count, Math.round(6 * scale));
  while (emptyIndexes.size < emptyTarget) emptyIndexes.add(Math.floor(random() * count));
  const assigned = new Set<string>();
  const lists: any[] = [];
  const yearSequences = new Map<number, number>();
  const lastByMonth = new Map<number, Date>();
  for (let index = 0; index < count; index++) {
    const monthIndex = monthSpecs[index]!;
    const year = 2024 + Math.floor((4 + monthIndex) / 12);
    const month = (4 + monthIndex) % 12;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const prior = lastByMonth.get(monthIndex);
    let created = prior
      ? new Date(prior.getTime() + logNormal(random, 4 * 3600000, 10 * 86400000))
      : weekdayTime(random, year, month, daysInMonth);
    if (created.getUTCMonth() !== month) created = weekdayTime(random, year, month, daysInMonth);
    while (created.getUTCDay() === 0 || created.getUTCDay() === 6)
      created = new Date(created.getTime() + day);
    if (created.getUTCFullYear() !== year || created.getUTCMonth() !== month) {
      created = new Date(Date.UTC(year, month, daysInMonth, 15, Math.floor(random() * 60)));
      while (created.getUTCDay() === 0 || created.getUTCDay() === 6)
        created = new Date(created.getTime() - day);
    }
    if (created.getUTCHours() < 8 || created.getUTCHours() > 15)
      created.setUTCHours(8 + Math.floor(random() * 8));
    lastByMonth.set(monthIndex, created);
    const pools = roots.map((root) => ({
      root,
      pool: (byRoot.get(root) ?? []).filter(
        (it) =>
          !assigned.has(it.id) &&
          Date.parse(requestById.get(it.requestId)?.at ?? "") < created.getTime(),
      ),
    }));
    const available = pools.filter((entry) => entry.pool.length > 0);
    const selected = available.length
      ? pick(random, available)
      : { root: pick(random, roots), pool: [] };
    const root = selected.root;
    const pool = selected.pool;
    pool.sort(
      (a, b) =>
        Number(b.progress === "Published") - Number(a.progress === "Published") ||
        Number(b.progress === "InProgress") - Number(a.progress === "InProgress"),
    );
    const wanted = emptyIndexes.has(index) ? 0 : logNormal(random, 15, 44);
    const members = pool.slice(0, wanted);
    const listId = `V-L-${year}-${String((yearSequences.get(year) ?? 0) + 1).padStart(3, "0")}`;
    yearSequences.set(year, (yearSequences.get(year) ?? 0) + 1);
    const starts = new Date(created.getTime() + day);
    while (starts.getUTCDay() === 0 || starts.getUTCDay() === 6)
      starts.setTime(starts.getTime() + day);
    const ends = new Date(starts.getTime() + (14 + Math.floor(random() * 15)) * day);
    const creator = staff[Math.floor(random() * 3)] ?? "vu1";
    const doneAt = new Date(ends.getTime() + day);
    const done =
      doneAt.getTime() < Date.parse(now) &&
      members.length > 0 &&
      members.every((it) => it.progress === "Published")
        ? { actorId: creator, at: doneAt.toISOString() }
        : null;
    let pages = 0;
    for (const iteration of members) {
      assigned.add(iteration.id);
      iteration.listId = listId;
      const document = documentById.get(iteration.documentId);
      const source = document?.pageSources
        ?.filter((entry: any) => entry.value != null)
        .sort((a: any, b: any) => b.tier - a.tier)[0];
      pages += source?.value ?? 154;
      if (iteration.progress === "Published") {
        const low = starts.getTime();
        const high = Math.min(ends.getTime(), Date.parse(now));
        const at = new Date(low + Math.floor(random() * (high - low + 1)));
        iteration.digitizedAt = at.toISOString();
        for (const link of iteration.links) link.setAt = iteration.digitizedAt;
      }
    }
    lists.push(
      digitizationListSchema.parse({
        id: listId,
        name: `${pick(random, words)} — ${new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(created)}`,
        startsOn: starts.toISOString().slice(0, 10),
        endsOn: ends.toISOString().slice(0, 10),
        targetPages: members.length ? Math.ceil(pages / 100) * 100 : null,
        generated: null,
        createdBy: creator,
        createdAt: created.toISOString(),
        done,
      }),
    );
  }
  for (const iteration of iterations) iterationSchema.parse(iteration);
  return lists;
}
