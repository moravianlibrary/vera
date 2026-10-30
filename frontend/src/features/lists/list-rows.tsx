// The digitization lists on RecordList (components/lists/record-list.tsx), one row per list:
// List, State, Runs, Items, Pages and Delivered (page-lists.js browse). Under each row one line
// says what needs a look: a list past its end and not marked Done, members blocked since
// listing, scans a new defect holds, or that it is empty; then what it counts towards besides
// the house mix, and the intention it was generated with.

import type { ListRow } from "@vera/contract/lists";
import type { DigitizationList } from "@vera/domain/entities";
import type { ReactElement } from "react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Muted } from "@/components/detail-card";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { RecordList } from "@/components/lists/record-list";
import type { QueryFailure } from "@/components/query-state";
import { ListStateBadge } from "@/components/status-badge";
import type { PagedList } from "@/hooks/use-paged-list";
import { formatShortCalendarDay } from "@/lib/format-date";
import { formatCount, formatPages } from "@/lib/format-number";

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
  failure?: QueryFailure;
  paging: PagedList;
  selectedId: string | null;
  onSelect: (listId: string) => void;
}

export function ListRows({
  rows,
  count,
  total,
  isLoading,
  failure,
  paging,
  selectedId,
  onSelect,
}: ListRowsProps) {
  const { t } = useTranslation("lists");
  return (
    <RecordList
      rows={rows}
      rowId={(row) => row.list.id}
      total={total}
      columns={listColumns}
      card={{
        title: (row) => row.list.name,
        meta: (row) => (
          <>
            <ListStateBadge state={row.state} />
            <span className="text-xs text-muted-foreground">
              {runsOf(row.list)} · {t("listRows.item", { count: row.itemCount })} ·{" "}
              {formatPages(row.pages)}
            </span>
          </>
        ),
      }}
      whyOf={(row) => <WhyLine row={row} />}
      toolbar={{ count }}
      paging={paging}
      isLoading={isLoading}
      failure={failure}
      selectedId={selectedId}
      onSelect={onSelect}
      loadingText={t("listRows.loading")}
      emptyText={t("listRows.empty")}
      loadingMoreText={t("listRows.loadingMore")}
    />
  );
}

export const listColumns: ColumnDefinition<ListRow>[] = [
  {
    key: "list",
    header: "lists:listRows.list",
    track: "minmax(10rem,1fr)",
    cell: (row) => (
      <>
        <span className="block text-ui leading-snug font-medium">{row.list.name}</span>
        <span className="mt-0.5 block truncate font-mono text-caption text-muted-foreground">
          {row.list.id}
        </span>
      </>
    ),
  },
  {
    key: "state",
    header: "lists:listRows.state",
    track: "fit-content(7rem)",
    cell: (row) => <ListStateBadge state={row.state} />,
  },
  {
    key: "runs",
    header: "lists:listRows.runs",
    track: "max-content",
    cell: (row) => <Muted>{runsOf(row.list)}</Muted>,
  },
  {
    key: "items",
    header: "lists:listRows.items",
    track: "max-content",
    isNumeric: true,
    cell: (row) => row.itemCount,
  },
  {
    key: "pages",
    header: "lists:listRows.pages",
    track: "max-content",
    isNumeric: true,
    cell: (row) => formatCount(row.pages),
  },
  {
    key: "delivered",
    header: "lists:listRows.delivered",
    track: "max-content",
    isNumeric: true,
    cell: (row) => {
      const share = deliveredShareOf(row);
      return share === null ? <Muted>—</Muted> : `${share}%`;
    },
  },
];

function WhyLine({ row }: { row: ListRow }) {
  const { t } = useTranslation("lists");
  const parts: ReactElement[] = [];
  if (row.state === "InProgress" && row.isOverdue) {
    parts.push(
      <b key="overdue" className="font-semibold text-foreground">
        {t("listRows.overdue")}
      </b>,
    );
  }

  if (row.blockedCount > 0) {
    parts.push(
      <b key="blocked" className="font-semibold text-tone-amber-foreground">
        {t("listRows.blocked", { count: row.blockedCount })}
      </b>,
    );
  }

  if (row.itemCount === 0) {
    parts.push(
      <span key="empty">
        <b className="font-semibold text-foreground">{t("listRows.emptyLabel")}</b> —{" "}
        {t("listRows.nothingOnList")}
      </span>,
    );
  }

  const counted = row.countsTowards.filter((intention) => !intention.isOverall);
  if (counted.length > 0) {
    parts.push(
      <span key="counts">
        {t("listRows.countsTowards")}{" "}
        {counted.slice(0, 2).map((intention, index) => (
          <Fragment key={intention.id}>
            {index > 0 && ", "}
            <b className="font-semibold text-foreground">{intention.name}</b>
          </Fragment>
        ))}
        {counted.length > 2 && ` +${counted.length - 2}`}
      </span>,
    );
  } else if (row.itemCount > 0) {
    parts.push(<span key="counts">{t("listRows.houseMixOnly")}</span>);
  }

  if (row.list.generated !== null) {
    parts.push(
      <span key="generated">
        {t("listRows.generatedWith", {
          name: row.generatedWith?.name ?? row.list.generated.generator,
        })}
      </span>,
    );
  }

  if (row.reviewNeededCount > 0) {
    parts.push(
      <b key="review" className="font-semibold text-tone-purple-foreground">
        {t("listRows.reviewNeeded", { count: row.reviewNeededCount })}
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
