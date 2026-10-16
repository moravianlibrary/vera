// A list against intentions (intentions.md §5; page-lists.js `mixHTML`, the *Counts towards* and
// *Mix* cards): what it counts towards, worked out from what is on it and when it starts, never
// attached, and its fill per category against one intention's mix, inside its scope. A correcting
// run is read against the allocation it accepted. The editor's top and the pane both use them.
// TODO(rrandiak): labels move to i18n.

import type { CountsTowardsRow, ListMix, ListMixRow } from "@vera/contract/lists";
import { Link } from "react-router";
import { formatCount } from "@/lib/format-number";
import { cn } from "@/lib/utils";

// Over its goal by more than this reads as over.
const overTolerance = 1.05;

const intentionHrefOf = (intentionId: string) => `/intentions?i=${encodeURIComponent(intentionId)}`;

// "NDK Periodika 1,740 pp · House mix 3,452 pp": overlapping, never totalled.
export function CountsTowardsLine({
  rows,
  canOpen,
}: {
  rows: readonly CountsTowardsRow[];
  canOpen: boolean;
}) {
  if (rows.length === 0) {
    return (
      <span className="text-muted-foreground">nothing yet — it counts once items are on it</span>
    );
  }

  return (
    <span className="flex flex-wrap gap-1.5">
      {rows.map((row) => (
        <span
          key={row.intentionId}
          className="rounded-full border bg-card px-2 py-0.5 text-xs whitespace-nowrap"
        >
          {canOpen ? (
            <Link to={intentionHrefOf(row.intentionId)} className="hover:underline">
              {row.name}
            </Link>
          ) : (
            row.name
          )}{" "}
          <span className="text-muted-foreground tabular-nums">{formatCount(row.pages)} pp</span>
        </span>
      ))}
    </span>
  );
}

function labelOf(row: ListMixRow, total: number, hasGoal: boolean): string {
  if (row.share === null) {
    return "unallocated";
  }

  if (row.share === 0) {
    return "excluded — 0%";
  }

  if (hasGoal && row.goalPages !== null) {
    return `${formatCount(row.pages)} / ${formatCount(row.goalPages)} pp`;
  }

  return `${total === 0 ? 0 : Math.round((row.pages / total) * 100)}% of its pages · ${formatCount(row.pages)} pp`;
}

// One meter per category: the pages on the list against its goal.
export function MixMeters({
  mix,
  hasTarget,
  isCompact = false,
}: {
  mix: ListMix;
  hasTarget: boolean;
  isCompact?: boolean;
}) {
  const total = mix.rows.reduce((sum, row) => sum + row.pages, 0);
  const hasGoal = hasTarget || mix.isAllocation;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-x-4 gap-y-2.5">
      {mix.rows.map((row) => {
        const fill =
          row.goalPages !== null && row.goalPages > 0
            ? Math.min(100, (row.pages / row.goalPages) * 100)
            : row.pages > 0
              ? 100
              : 0;
        const isOver = row.goalPages !== null && row.pages > row.goalPages * overTolerance;
        return (
          <div key={row.categoryId} className={cn("grid gap-1", row.share === 0 && "opacity-60")}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <b className="truncate font-semibold">{row.name}</b>
              <span className="text-muted-foreground tabular-nums">
                {row.share === null ? "" : `${Math.round(row.share)}%`}
              </span>
            </div>
            <span className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <span
                className={cn("block h-full", isOver ? "bg-tone-amber-foreground" : "bg-chart-3")}
                style={{ width: `${fill}%` }}
              />
            </span>
            {!isCompact && (
              <span
                className={cn(
                  "text-[0.6875rem] text-muted-foreground",
                  row.share === null && "text-tone-amber-foreground",
                )}
              >
                {labelOf(row, total, hasGoal)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
