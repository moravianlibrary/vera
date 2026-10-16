// One intention on the Intentions page (docs/demos/shared/page-intentions.js card; STATUS
// "Intentions"). The card is the whole record: it opens in place, never on a page of its own. A
// target draws time, planned and delivered against its target with the even-pace mark, and what
// it needs to get there; opened, its share of the target per category and the lists that start
// in its window. A tracking card draws the intended mix over the output, with the categories out
// of the ±5 band; opened, the drift per category. Under both, the mix it reads and whose it is.
// Its acts sit in the foot, beside what the Overall intention cannot have done to it; the mix line
// links to its Mix.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import { Link } from "react-router";
import type { FillRowView, IntentionRow, MixRowView } from "@/api/intentions";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import { RecordCard } from "@/components/card-sections";
import { DataTable } from "@/components/data-table";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { ToneBadge } from "@/components/status-badge";
import { MixBar, MixBars } from "@/components/visualizations/mix-bars";
import { PaceBars } from "@/components/visualizations/pace-bars";
import { mixBand } from "@/domain/intentions";
import {
  bandText,
  everyLabels,
  metaOf,
  mixLabelOf,
  mixSourceOf,
  outputBasisOf,
  outputSinceOf,
  scopePathOf,
  shareTextOf,
  signedPoints,
  timeLabelOf,
  verdictBadgeOf,
  worstDriftOf,
} from "@/features/intentions/intentions-view";
import { conditionTextOf } from "@/features/properties/scope-conditions-field";
import { usePropertiesQuery } from "@/features/properties/use-properties-query";
import { useTier } from "@/hooks/use-tier";
import { formatCalendarDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";

// *Edit mix* or *Proportions*, to its Mix.
export interface MixLink {
  label: string;
  href: string;
}

interface IntentionCardProps {
  row: IntentionRow;
  repeatEvery: keyof typeof everyLabels | null;
  isOpen: boolean;
  // Only what the person may do to it.
  actions: readonly ViewAction[];
  mixLink: MixLink | null;
}

export function IntentionCard({ row, repeatEvery, isOpen, actions, mixLink }: IntentionCardProps) {
  const { intention } = row;
  const isTracking = intention.targetPages === null;
  return (
    <RecordCard
      title={intention.name}
      className={cn(
        "gap-2.5",
        intention.isOverall &&
          "border-tone-purple-foreground shadow-[inset_3px_0_0_var(--color-tone-purple-foreground)]",
      )}
      badges={<IntentionBadges row={row} repeatEvery={repeatEvery} />}
      meta={
        <>
          {metaOf(row)}
          <ScopeLine row={row} />
        </>
      }
      body={
        <>
          {intention.description !== "" && (
            <p className="text-[0.8125rem] text-muted-foreground">{intention.description}</p>
          )}
          {isTracking ? (
            <TrackingBody row={row} isOpen={isOpen} />
          ) : (
            <TargetBody row={row} isOpen={isOpen} />
          )}
          <MixStrip row={row} isBarShown={!isTracking || row.outputPages === 0} mixLink={mixLink} />
        </>
      }
      foot={
        intention.isOverall || actions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {intention.isOverall && (
              <span>The default mix for generating. Cannot be archived or deleted.</span>
            )}
            <ActionBar actions={actions} className="ml-auto" />
          </div>
        ) : undefined
      }
    />
  );
}

function IntentionBadges({
  row,
  repeatEvery,
}: {
  row: IntentionRow;
  repeatEvery: keyof typeof everyLabels | null;
}) {
  const verdict = verdictBadgeOf(row);
  return (
    <>
      {row.intention.targetPages === null ? (
        <ToneBadge tone="slate">Output</ToneBadge>
      ) : (
        <ToneBadge tone="blue">Target</ToneBadge>
      )}
      {row.intention.isOverall && <ToneBadge tone="purple">Overall</ToneBadge>}
      {row.intention.projectId !== null && <ToneBadge tone="blue">Project</ToneBadge>}
      {row.state === "Upcoming" && <ToneBadge tone="slate">Upcoming</ToneBadge>}
      {row.outOfBandCount > 0 && <ToneBadge tone="red">Out of band</ToneBadge>}
      {verdict !== null && <ToneBadge tone={verdict.tone}>{verdict.text}</ToneBadge>}
      {repeatEvery !== null && <ToneBadge tone="slate">↻ {everyLabels[repeatEvery]}</ToneBadge>}
    </>
  );
}

function ScopeLine({ row }: { row: IntentionRow }) {
  const { funding } = row.intention;
  const { data: propertyIndex } = usePropertiesQuery();
  const parts: { key: string; part: ReactNode }[] = [];
  if (funding.kind === "none") {
    parts.push({ key: "funding", part: "Counts work without a project" });
  }

  if (row.project !== null) {
    parts.push({
      key: "funding",
      part: (
        <>
          {row.intention.projectId === null ? "Project: " : "The project's own: "}
          <Link
            to={`/projects/${encodeURIComponent(row.project.id)}`}
            className="underline underline-offset-2 hover:text-foreground"
          >
            {row.project.name}
          </Link>
        </>
      ),
    });
  }

  if (row.scope !== null) {
    parts.push({ key: "scope", part: `Only ${scopePathOf(row.scope.path)}` });
  }

  // PLAN-scope: its conditions on properties.
  for (const condition of row.intention.scopeConditions ?? []) {
    const definition = propertyIndex?.definitions.find(
      (candidate) => candidate.key === condition.key,
    );
    parts.push({ key: `property-${condition.key}`, part: conditionTextOf(definition, condition) });
  }

  if (parts.length === 0) {
    return null;
  }

  return (
    <div>
      {parts.map(({ key, part }, index) => (
        <span key={key}>
          {index > 0 && " · "}
          {part}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- a target

function TargetBody({ row, isOpen }: { row: IntentionRow; isOpen: boolean }) {
  const { intention } = row;
  const target = intention.targetPages ?? 0;
  const isOpenEndedShort =
    intention.endsOn === null && row.state === "Running" && row.deliveredPages < target;
  return (
    <>
      <PaceBars
        target={target}
        timeElapsed={
          intention.endsOn === null ? null : row.state === "Upcoming" ? 0 : row.timeElapsed
        }
        timeLabel={timeLabelOf(row)}
        pages={{ planned: row.plannedPages, delivered: row.deliveredPages }}
        evenPace={row.evenPace}
      />
      {row.pagesPerWeekNeeded !== null && intention.endsOn !== null && (
        <p className="text-[0.8125rem] text-muted-foreground">
          Needs{" "}
          <b className="font-semibold text-foreground">
            {formatCount(row.pagesPerWeekNeeded)} pp/week
          </b>{" "}
          to reach it by {formatCalendarDay(intention.endsOn)}
        </p>
      )}
      {isOpenEndedShort && (
        <p className="text-[0.8125rem] text-muted-foreground">
          <b className="font-semibold text-foreground">
            {formatCount(target - row.deliveredPages)} pp
          </b>{" "}
          to go · no end, so no pace
        </p>
      )}
      {row.outOfBandCount > 0 && (
        <div className="grid gap-1.5">
          <DriftLine rows={row.mixRows} isIndented={false} />
          <OutOfBandDetail row={row} />
        </div>
      )}
      <Expansion label="Per category and lists" isOpen={isOpen}>
        <DataTable
          rows={row.fill}
          rowId={(fill) => fill.categoryId}
          columns={{ notebook: fillColumns(row) }}
          emptyText="No category in its scope."
        />
        <Fine>
          A planned figure in amber is short of its share. Shares are read{" "}
          {row.scope === null
            ? "of the whole tree"
            : `inside ${row.scope.path.at(-1)} — it is 100% here, whatever it gets globally`}
          .
        </Fine>
        <h4 className="mt-3 mb-1 text-xs font-semibold text-muted-foreground">
          Lists starting in its window
        </h4>
        {row.lists.length === 0 ? (
          <Fine>None yet.</Fine>
        ) : (
          <ul className="grid gap-1 text-[0.8125rem]">
            {row.lists.map((list) => (
              <li key={list.id} className="flex flex-wrap justify-between gap-x-3">
                <span>
                  <Link
                    to={`/lists?id=${encodeURIComponent(list.id)}`}
                    className="underline underline-offset-2"
                  >
                    {list.name}
                  </Link>{" "}
                  <span className="font-mono text-xs text-muted-foreground">{list.id}</span>
                </span>
                <span className="text-muted-foreground">
                  {plural(list.itemCount, "item")} · {formatCount(list.pages)} pp
                </span>
              </li>
            ))}
          </ul>
        )}
        <NotCounted row={row} />
      </Expansion>
    </>
  );
}

function fillColumns(row: IntentionRow): ColumnDefinition<FillRowView>[] {
  const pagesColumn = (
    key: string,
    header: string,
    cell: (fill: FillRowView) => ReactNode,
  ): ColumnDefinition<FillRowView> => ({
    key,
    header,
    track: "max-content",
    isNumeric: true,
    cell,
  });
  const columns: ColumnDefinition<FillRowView>[] = [
    {
      key: "category",
      header: row.scope === null ? "Category" : `Within ${row.scope.path.at(-1)}`,
      track: "minmax(8rem,1fr)",
      cell: (fill) => scopePathOf(fill.path),
    },
    pagesColumn("share", "Share", (fill) => (
      <span
        className={cn(
          fill.share === null && "text-tone-amber-foreground",
          fill.share === 0 && "text-muted-foreground",
        )}
      >
        {shareTextOf(fill.share)}
      </span>
    )),
    pagesColumn("target", "Target pp", (fill) =>
      fill.targetPages === null ? "—" : formatCount(fill.targetPages),
    ),
    pagesColumn("planned", "Planned", (fill) => (
      <span className={cn(fill.isShort && "font-semibold text-tone-amber-foreground")}>
        {formatCount(fill.plannedPages)}
      </span>
    )),
    pagesColumn("delivered", "Delivered", (fill) => formatCount(fill.deliveredPages)),
  ];
  return row.mix === null
    ? columns.filter((column) => ["category", "planned", "delivered"].includes(column.key))
    : columns;
}

// ---------------------------------------------------------------- tracking the mix

const flagBadges = {
  inBand: { text: "In band", tone: "green" },
  over: { text: "Over", tone: "red" },
  under: { text: "Under", tone: "blue" },
  excludedUsed: { text: "Excluded category used", tone: "red" },
  noShare: { text: "No share", tone: "amber" },
} as const;

function TrackingBody({ row, isOpen }: { row: IntentionRow; isOpen: boolean }) {
  const basis = outputBasisOf(row);
  return (
    <>
      <p className="text-[0.8125rem] text-muted-foreground">
        {basis ?? (
          <>
            {outputSinceOf(row)} ·{" "}
            <b className="font-semibold text-foreground">{formatCount(row.outputPages)} pp</b>{" "}
            digitized{row.scope === null ? "" : ` in ${row.scope.path.at(-1)}`}
          </>
        )}
      </p>
      {row.outputPages > 0 && row.mix !== null && (
        <div className="grid gap-1.5">
          <MixBars
            categories={row.mixRows.map((mixRow) => ({
              id: mixRow.categoryId,
              label: mixRow.name,
              intended: mixRow.intended,
              actual: mixRow.output,
            }))}
          />
          <DriftLine rows={row.mixRows} />
        </div>
      )}
      {row.outOfBandCount > 0 ? (
        <OutOfBandDetail row={row} />
      ) : (
        row.outputPages > 0 &&
        row.mix !== null && (
          <p className="text-[0.8125rem] text-tone-green-foreground">
            Every category within {bandText} points.
          </p>
        )
      )}
      {row.unallocated > 0.5 && (
        <p className="text-[0.8125rem] text-tone-amber-foreground">
          {Math.round(row.unallocated)}% of the mix is unallocated
        </p>
      )}
      <Expansion label={row.mix === null ? "Output by category" : "Per category"} isOpen={isOpen}>
        <DataTable
          rows={row.mixRows}
          rowId={(mixRow) => mixRow.categoryId}
          columns={{ notebook: driftColumns(row) }}
          emptyText="One category, all of it."
        />
        {row.mix !== null && (
          <Fine>
            Intended is the mix{row.scope === null ? "" : ` within ${row.scope.path.at(-1)}`}
            {"; "}
            planned is over the {formatCount(row.plannedPages)} pp on lists starting in its window;
            output is over the {formatCount(row.outputPages)} pp digitized in it, whenever they were
            planned. Drift is output minus intended, in points; {bandText} is display tolerance, not
            a change to the mix.
          </Fine>
        )}
        <NotCounted row={row} />
      </Expansion>
    </>
  );
}

function OutOfBandDetail({ row }: { row: IntentionRow }) {
  const worst = worstDriftOf(row.mixRows);
  return (
    <p className="text-[0.8125rem] text-tone-red-foreground">
      {plural(row.outOfBandCount, "category", "categories")} out of the {bandText} band
      {worst !== null && worst.drift !== null && (
        <>
          {" "}
          · worst:{" "}
          <b className="font-semibold">
            {worst.name} {signedPoints(worst.drift)} pts
          </b>
        </>
      )}
    </p>
  );
}

// Under the two bars: each category off its share, in the direction it is off.
function DriftLine({
  rows,
  isIndented = true,
}: {
  rows: readonly MixRowView[];
  isIndented?: boolean;
}) {
  const off = rows.filter((mixRow) => mixRow.flag !== null && mixRow.flag !== "inBand");
  if (off.length === 0) {
    return null;
  }

  return (
    <p className={cn("text-xs font-semibold", isIndented && "pl-[5.5rem]")}>
      {off.map((mixRow, index) => (
        <span key={mixRow.categoryId}>
          {index > 0 && <span className="font-normal text-muted-foreground"> · </span>}
          <span
            className={cn(
              mixRow.flag === "under" && "text-chart-3",
              (mixRow.flag === "over" || mixRow.flag === "excludedUsed") &&
                "text-tone-red-foreground",
              mixRow.flag === "noShare" && "font-normal text-tone-amber-foreground",
            )}
          >
            {mixRow.name}{" "}
            {mixRow.flag === "excludedUsed"
              ? "excluded, used"
              : mixRow.flag === "noShare"
                ? "no share"
                : signedPoints(mixRow.drift ?? 0)}
          </span>
        </span>
      ))}
    </p>
  );
}

const percentCell = (value: number | null) =>
  value === null ? <span className="text-muted-foreground">—</span> : `${Math.round(value)}%`;

function driftColumns(row: IntentionRow): ColumnDefinition<MixRowView>[] {
  const numeric = (
    key: string,
    header: string,
    cell: (mixRow: MixRowView) => ReactNode,
  ): ColumnDefinition<MixRowView> => ({ key, header, track: "max-content", isNumeric: true, cell });
  const columns: ColumnDefinition<MixRowView>[] = [
    {
      key: "category",
      header: row.scope === null ? "Category" : `Within ${row.scope.path.at(-1)}`,
      track: "minmax(7rem,1fr)",
      cell: (mixRow) => mixRow.name,
    },
    numeric("intended", "Intended", (mixRow) =>
      mixRow.intended === null ? (
        <span className="text-tone-amber-foreground">—</span>
      ) : (
        percentCell(mixRow.intended)
      ),
    ),
    numeric("planned", "Planned", (mixRow) => percentCell(mixRow.planned)),
    numeric("output", "Output", (mixRow) => percentCell(mixRow.output)),
    numeric("drift", "Drift", (mixRow) =>
      mixRow.drift === null ? null : (
        <span
          className={cn(
            Math.abs(mixRow.drift) > mixBand
              ? mixRow.drift > 0
                ? "font-semibold text-tone-red-foreground"
                : "font-semibold text-chart-3"
              : "text-muted-foreground",
          )}
        >
          {signedPoints(mixRow.drift)}
        </span>
      ),
    ),
    {
      key: "flag",
      header: "",
      track: "max-content",
      cell: (mixRow) =>
        mixRow.flag === null ? null : (
          <ToneBadge tone={flagBadges[mixRow.flag].tone}>{flagBadges[mixRow.flag].text}</ToneBadge>
        ),
    },
  ];
  return row.mix === null
    ? columns.filter((column) => ["category", "planned", "output"].includes(column.key))
    : columns;
}

// ---------------------------------------------------------------- the mix it reads

// The intended shares as one bar, unless a tracking card already draws them above; then what
// they are in words, and whose mix it is.
interface MixStripProps {
  row: IntentionRow;
  isBarShown: boolean;
  mixLink: MixLink | null;
}

function MixStrip({ row, isBarShown, mixLink }: MixStripProps) {
  const isPhone = useTier() === "phone";
  const shown = isPhone ? row.mixRows.slice(0, 5) : row.mixRows;
  const hidden = row.mixRows.length - shown.length;
  return (
    <div className="grid gap-1.5">
      {isBarShown && row.mix !== null && row.mixRows.length > 0 && (
        <MixBar
          shares={row.mixRows.map((mixRow) => ({
            id: mixRow.categoryId,
            label: mixRow.name,
            value: mixRow.intended,
          }))}
          unallocated={row.unallocated}
        />
      )}
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
        <span className="font-medium">{mixLabelOf(row)}</span>
        <span className="text-muted-foreground">
          {row.mixRows.length === 0
            ? row.mix === null
              ? "— output only"
              : "— one category, all of it"
            : shown.map((mixRow, index) => (
                <span key={mixRow.categoryId}>
                  {index > 0 && " · "}
                  {mixRow.name}{" "}
                  {row.mix === null ? (
                    mixRow.output === null ? (
                      "—"
                    ) : (
                      Math.round(mixRow.output)
                    )
                  ) : mixRow.intended === null ? (
                    <span className="text-tone-amber-foreground">—</span>
                  ) : (
                    Math.round(mixRow.intended)
                  )}
                </span>
              ))}
          {hidden > 0 && ` · +${hidden} more`}
          {row.unallocated > 0.5 && (
            <span className="text-tone-amber-foreground">
              {" "}
              · {Math.round(row.unallocated)}% unallocated
            </span>
          )}
        </span>
        <span className="ml-auto text-muted-foreground">
          {mixSourceOf(row)}
          {mixLink !== null && (
            <>
              {" · "}
              <Link to={mixLink.href} className="text-foreground hover:underline">
                {mixLink.label}
              </Link>
            </>
          )}
          {row.mix !== null && (
            <>
              {" "}
              ·{" "}
              <Link to={`/mixes/${row.mix.id}`} className="text-foreground hover:underline">
                View shared mix
              </Link>
            </>
          )}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- small parts

function Expansion({
  label,
  isOpen,
  children,
}: {
  label: string;
  isOpen: boolean;
  children: ReactNode;
}) {
  return (
    <details open={isOpen} className="group text-[0.8125rem]">
      <summary className="cursor-pointer py-0.5 font-medium text-muted-foreground hover:text-foreground">
        {label}
      </summary>
      <div className="mt-2 grid gap-2">{children}</div>
    </details>
  );
}

function Fine({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

function NotCounted({ row }: { row: IntentionRow }) {
  const parts = [
    row.noDateCount > 0
      ? `${plural(row.noDateCount, "item")} digitized with no date recorded`
      : null,
    row.noPagesCount > 0 ? `${plural(row.noPagesCount, "item")} with no page count` : null,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : <Fine>{parts.join("; ")} — not counted.</Fine>;
}
