// The List generator plugin played by the mock, choosing items and reporting its shortfall.
import type {
  GenerateAnswer,
  GenerateInput,
  ShortfallCause,
} from "@vera/domain/plugin-api/list-generator";
import { formatShortCalendarDay } from "@/lib/format-date";
import { advisorReasons } from "@/mocks/fixtures/list-generators";

// A little slack on a category's own goal, so one document just over it is still taken.
const pageSlack = 50;

export function generate(
  input: GenerateInput,
  configuration: Readonly<Record<string, string>>,
  isAdvisor: boolean,
): GenerateAnswer {
  const tolerance = (Number.parseFloat(configuration.tolerance ?? "") || 5) / 100;
  const leaves = input.leaves;
  const pool = input.pool;
  const isAllowed = (categoryId: string) =>
    input.topCategoryIds.length === 0 ||
    input.topCategoryIds.includes(
      leaves.find((leaf) => leaf.id === categoryId)?.topCategoryId ?? categoryId,
    );
  const pagesIn = (categoryId: string, of: typeof input.members) =>
    of
      .filter((item) => item.iteration.categoryId === categoryId)
      .reduce((sum, item) => sum + item.pages, 0);

  let total = input.members.reduce((sum, item) => sum + item.pages, 0);
  if (!input.hasMix) {
    const picks: GenerateAnswer["picks"] = [];
    for (const item of pool) {
      if (total >= input.pages || total + item.pages > input.pages * (1 + tolerance) + pageSlack)
        continue;
      if (!isAllowed(item.iteration.categoryId)) continue;
      picks.push({
        iterationId: item.iteration.id,
        why: `${item.iteration.priority} priority · asked ${formatShortCalendarDay(item.askedAt.slice(0, 10))}`,
      });
      total += item.pages;
    }
    return { picks, spreadCount: 0, shortfalls: [] };
  }

  const goalOf = (leaf: GenerateInput["leaves"][number]) => {
    const share = leaf.share ?? 0;
    if (input.allocation === null) return (input.pages * share) / 100;
    const node =
      leaf.nodeId === null ? undefined : input.nodes.find(({ id }) => id === leaf.nodeId);
    const nodeShare = node?.share ?? 0;
    return node === undefined || nodeShare === 0
      ? 0
      : ((input.allocation[node.id] ?? 0) * share) / nodeShare;
  };
  const picks: GenerateAnswer["picks"] = [];
  const picked = new Set<string>();
  const got = new Map(leaves.map((leaf) => [leaf.id, pagesIn(leaf.id, input.members)]));
  const goal = new Map(leaves.map((leaf) => [leaf.id, goalOf(leaf)]));
  const take = (item: (typeof pool)[number], covers: GenerateInput["leaves"][number] | null) => {
    const asked = `${item.iteration.priority} priority · asked ${formatShortCalendarDay(item.askedAt.slice(0, 10))}`;
    const isInPlaceOf = covers !== null && covers.id !== item.iteration.categoryId;
    const rule = isInPlaceOf ? `${asked} · covers ${covers.name}` : asked;
    picks.push({
      iterationId: item.iteration.id,
      why: isAdvisor ? (advisorReasons[item.iteration.id] ?? "Fits the mix.") : rule,
    });
    picked.add(item.iteration.id);
    total += item.pages;
    const category = item.iteration.categoryId;
    got.set(category, (got.get(category) ?? 0) + item.pages);
  };

  // Each leaf to its share.
  for (const leaf of leaves) {
    const target = goal.get(leaf.id) ?? 0;
    if ((leaf.share ?? 0) === 0 || !isAllowed(leaf.id)) continue;
    for (const item of pool.filter((candidate) => candidate.iteration.categoryId === leaf.id)) {
      const filled = got.get(leaf.id) ?? 0;
      if (filled < target && filled + item.pages <= target * (1 + tolerance) + pageSlack) {
        take(item, null);
      }
    }
  }

  const shortOf = (categoryId: string) => {
    const target = goal.get(categoryId) ?? 0;
    const missing = target - (got.get(categoryId) ?? 0);
    return missing > target * tolerance ? missing : 0;
  };

  // A share a mix cannot fill goes to the nearest categories with supply; corrections stay short.
  let spreadCount = 0;
  const short = input.allocation === null ? leaves.filter((leaf) => shortOf(leaf.id) > 0) : [];
  for (const leaf of short.toSorted((first, second) => shortOf(second.id) - shortOf(first.id))) {
    let need = shortOf(leaf.id);
    const distanceOf = (item: (typeof pool)[number]) => {
      const category = leaves.find(({ id }) => id === item.iteration.categoryId);
      if (category?.parentId === leaf.parentId) return 0;
      return category?.topCategoryId === leaf.topCategoryId ? 1 : 2;
    };
    const candidates = pool
      .filter((item) => !picked.has(item.iteration.id))
      .filter((item) => isAllowed(item.iteration.categoryId))
      .filter((item) => (leaves.find(({ id }) => id === item.iteration.categoryId)?.share ?? 0) > 0)
      .toSorted((first, second) => distanceOf(first) - distanceOf(second));
    for (const item of candidates) {
      if (need > 0 && total + item.pages <= input.pages * (1 + tolerance)) {
        take(item, leaf);
        need -= item.pages;
        spreadCount += item.iteration.categoryId === leaf.id ? 0 : 1;
      }
    }
  }

  const shortfalls = leaves.flatMap((leaf) => {
    const missing = shortOf(leaf.id);
    const hasSupplyLeft = pool.some(
      (item) => item.iteration.categoryId === leaf.id && !picked.has(item.iteration.id),
    );
    const cause = causeOf(missing, leaf.share, isAllowed(leaf.id), hasSupplyLeft);
    return cause === null ? [] : [{ categoryId: leaf.id, pages: Math.round(missing), cause }];
  });
  return { picks, spreadCount, shortfalls };
}

function causeOf(
  missing: number,
  share: number | null,
  isAllowed: boolean,
  hasSupplyLeft: boolean,
): ShortfallCause | null {
  if (share === null) return "unallocated";
  if (missing === 0) return null;
  if (!isAllowed) return "leftOut";
  return hasSupplyLeft ? "overshoot" : "noSupply";
}
