// The digitization lists on RecordList (components/lists/record-list.tsx), one row per list:
// List, State, Runs, Items, Pages and Delivered (page-lists.js browse). Under each row one line
// says what needs a look: a list past its end and not marked Done, members blocked since
// listing, scans a new defect holds, or that it is empty.
// TODO(rrandiak): the why line's *Counts towards* and *generated with [intention]* wait for
// intentions in the mock API (plan.md step 6).
// TODO(rrandiak): labels move to i18n.

import type { ReactElement } from "react";
import { Fragment } from "react";
import type { ListRow } from "@/api/lists";
import { Muted } from "@/components/detail-card";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { RecordList } from "@/components/lists/record-list";
import type { Tone } from "@/components/status-badge";
import { ToneBadge } from "@/components/status-badge";
import type { DigitizationList } from "@/domain/entities";
import type { ListState } from "@/domain/lists";
import type { PagedList } from "@/hooks/use-paged-list";
import { formatShortCalendarDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";

export const listStateLabels = {
  Planned: "Planned",
  InProgress: "In progress",
  Done: "Done",
} as const satisfies Record<ListState, string>;

const listStateTones = {
  Planned: "blue",
  InProgress: "blue",
  Done: "green",
} as const satisfies Record<ListState, Tone>;

export function ListStateBadge({ state }: { state: ListState }) {
  return <ToneBadge tone={listStateTones[state]}>{listStateLabels[state]}</ToneBadge>;
}

// "22 Jun → 10 Jul".
export function runsOf(list: DigitizationList): string {
  return `${formatShortCalendarDay(list.startsOn)} → ${formatShortCalendarDay(list.endsOn)}`;
}

export function deliveredShareOf(row: ListRow): number | null {
  return row.pages === 0 ? null : Math.round((row.scannedPages / row.pages) * 100);
}

interface ListRowsProps {
  rows: ListRow[] | undefined;
  // "4 lists · 14 ready to list, 5,230 pp".
  count: string;
  total: number | undefined;
  isLoading: boolean;
  paging: PagedList;
  selectedId: string | null;
  onSelect: (listId: string) => void;
}

export function ListRows({
  rows,
  count,
  total,
  isLoading,
  paging,
  selectedId,
  onSelect,
}: ListRowsProps) {
  return (
    <RecordList
      rows={rows}
      rowId={(row) => row.list.id}
      total={total}
      columns={columns}
      card={{
        title: (row) => row.list.name,
        meta: (row) => (
          <>
            <ListStateBadge state={row.state} />
            <span className="text-xs text-muted-foreground">
              {runsOf(row.list)} · {plural(row.itemCount, "item")} · {formatCount(row.pages)} pp
            </span>
          </>
        ),
      }}
      whyOf={(row) => <WhyLine row={row} />}
      toolbar={{ count }}
      paging={paging}
      isLoading={isLoading}
      selectedId={selectedId}
      onSelect={onSelect}
      loadingText="Loading lists…"
      emptyText="No lists here."
      loadingMoreText="Loading more…"
    />
  );
}

const columns: ColumnDefinition<ListRow>[] = [
  {
    key: "list",
    header: "List",
    track: "minmax(10rem,1fr)",
    cell: (row) => (
      <>
        <span className="block text-[0.8125rem] leading-snug font-medium">{row.list.name}</span>
        <span className="mt-0.5 block truncate font-mono text-[0.6875rem] text-muted-foreground">
          {row.list.id}
        </span>
      </>
    ),
  },
  {
    key: "state",
    header: "State",
    track: "fit-content(7rem)",
    cell: (row) => <ListStateBadge state={row.state} />,
  },
  {
    key: "runs",
    header: "Runs",
    track: "max-content",
    cell: (row) => <Muted>{runsOf(row.list)}</Muted>,
  },
  {
    key: "items",
    header: "Items",
    track: "max-content",
    isNumeric: true,
    cell: (row) => row.itemCount,
  },
  {
    key: "pages",
    header: "Pages",
    track: "max-content",
    isNumeric: true,
    cell: (row) => formatCount(row.pages),
  },
  {
    key: "delivered",
    header: "Delivered",
    track: "max-content",
    isNumeric: true,
    cell: (row) => {
      const share = deliveredShareOf(row);
      return share === null ? <Muted>—</Muted> : `${share}%`;
    },
  },
];

function WhyLine({ row }: { row: ListRow }) {
  const parts: ReactElement[] = [];
  if (row.state === "InProgress" && row.isOverdue) {
    parts.push(
      <b key="overdue" className="font-semibold text-foreground">
        Ended — not marked Done yet
      </b>,
    );
  }

  if (row.blockedCount > 0) {
    parts.push(
      <b key="blocked" className="font-semibold text-tone-amber-foreground">
        ⚠ {row.blockedCount} blocked since listing
      </b>,
    );
  }

  if (row.itemCount === 0) {
    parts.push(
      <span key="empty">
        <b className="font-semibold text-foreground">Empty</b> — nothing on it yet
      </span>,
    );
  }

  if (row.list.generated !== null) {
    parts.push(<span key="generated">generated by {row.list.generated.generator}</span>);
  }

  if (row.reviewNeededCount > 0) {
    parts.push(
      <b key="review" className="font-semibold text-tone-purple-foreground">
        {row.reviewNeededCount} digitized, review needed
      </b>,
    );
  }

  return parts.map((part, index) => (
    <Fragment key={part.key}>
      {index > 0 && " · "}
      {part}
    </Fragment>
  ));
}
