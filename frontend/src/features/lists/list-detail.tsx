// One digitization list beside the browse list (page-lists.js render): a note on where it
// stands, planned against delivered, what is on it, and its history. A member a gate stopped
// after listing stays on, flagged (flows.md L11); one that could not be digitized carries its
// message, and a cancelled one its reason. Its acts, and each member's, are list-actions.tsx.
// What it counts towards is worked out, never attached; what it was generated with is
// provenance, and its mix is read against that intention, else Overall (intentions.md §5).

import type { ListDetail, ListItem } from "@vera/contract/lists";
import { documentIdentifierOf } from "@vera/domain/documents";
import type { Session } from "@vera/domain/entities";
import type { MemberBlocker } from "@vera/domain/lists";
import { isScanned } from "@vera/domain/lists";
import { can } from "@vera/domain/permissions";
import { iterationStatusOf, statusFootnoteOf } from "@vera/domain/status";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ActionBar } from "@/components/actions/action-bar";
import { categoryLabelOf } from "@/components/classification-fields";
import { DetailCard, DetailRow, FinePrint, Muted, StatTiles } from "@/components/detail-card";
import { visibleNavigation } from "@/components/layout/navigation";
import { HistoryCard, RecordHeading } from "@/components/record-cards";
import { StatusWithFootnote } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { ItemActions, useListActions } from "@/features/lists/list-actions";
import { MixMeters } from "@/features/lists/list-intentions";
import { useCategoriesQuery, useUsersQuery } from "@/hooks/use-reference-query";
import { formatCalendarDay, formatDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";

const blockerTexts = {
  Forbidden: "lists:blocker.Forbidden",
  ReviewNeeded: "lists:blocker.ReviewNeeded",
  ValidationDenied: "lists:blocker.ValidationDenied",
} as const satisfies Record<MemberBlocker, string>;

interface ListDetailPaneProps {
  detail: ListDetail;
  session: Session;
  onDeleted: () => void;
}

export function ListDetailPane({ detail, session, onDeleted }: ListDetailPaneProps) {
  const { t } = useTranslation("lists");
  const { row, members, log } = detail;
  const { list } = row;
  const { data: users = [] } = useUsersQuery();
  const nameOf = (userId: string) => users.find((user) => user.id === userId)?.name ?? userId;
  const documents = visibleNavigation(session).find((entry) => entry.id === "documents");
  const documentHref = (item: ListItem) =>
    documents === undefined
      ? undefined
      : `${documents.path}?id=${encodeURIComponent(item.document.id)}`;
  const average = row.itemCount === 0 ? null : Math.round(row.pages / row.itemCount);
  const { actions, dialogs } = useListActions({ detail, session, onDeleted });

  return (
    <article className="@container max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-x-4">
        <RecordHeading
          title={list.name}
          identifier={list.id}
          details={[
            `${formatCalendarDay(list.startsOn)} → ${formatCalendarDay(list.endsOn)}`,
            list.generated === null
              ? null
              : t("listDetail.generatedBy", { name: list.generated.generator }),
          ]}
        />
        <ActionBar actions={actions} menuLabel={t("listDetail.more")} className="mb-4" />
      </div>
      {dialogs}
      <StateNote detail={detail} nameOf={nameOf} />

      <StatTiles
        stats={[
          {
            label: t("listDetail.pagesPlanned"),
            value: formatCount(row.pages),
            foot:
              list.targetPages === null
                ? t("listDetail.noTarget")
                : t("listDetail.targetFoot", { pages: formatCount(list.targetPages) }),
            meter: list.targetPages === null ? undefined : (row.pages / list.targetPages) * 100,
          },
          {
            label: t("listDetail.delivered"),
            value: formatCount(row.scannedPages),
            foot: t("listDetail.deliveredFoot", {
              scanned: row.scannedItemCount,
              count: row.itemCount,
            }),
            meter: row.pages === 0 ? 0 : (row.scannedPages / row.pages) * 100,
          },
          {
            label: t("listDetail.items"),
            value: row.itemCount,
            foot:
              average === null
                ? t("listDetail.empty")
                : t("listDetail.average", { pages: formatCount(average) }),
          },
        ]}
      />

      <div className="mt-4 grid gap-4">
        <DetailCard title={`On this list — ${members.length}`}>
          {members.length === 0 && <Muted>{t("listDetail.membersEmpty")}</Muted>}
          {members.map((item) => (
            <MemberRow
              key={item.iteration.id}
              item={item}
              href={documentHref(item)}
              actions={<ItemActions item={item} detail={detail} session={session} />}
            />
          ))}
        </DetailCard>
        <IntentionCards detail={detail} canOpen={can(session, "intention.read")} />
        <HistoryCard log={log} nameOf={nameOf} isPublic={false} />
      </div>
    </article>
  );
}

function IntentionCards({ detail, canOpen }: { detail: ListDetail; canOpen: boolean }) {
  const { t } = useTranslation("lists");
  const { row, countsTowards, mix } = detail;
  const generated = row.list.generated;
  return (
    <>
      <DetailCard title={t("listDetail.countsTowards")}>
        {countsTowards.length === 0 && <Muted>{t("listDetail.countsEmpty")}</Muted>}
        {countsTowards.map((counted) => (
          <DetailRow
            key={counted.intentionId}
            aside={
              <Muted>
                {t("listDetail.countedItem", { count: counted.itemCount })} ·{" "}
                {formatCount(counted.pages)} pp
              </Muted>
            }
          >
            {canOpen ? (
              <Link
                to={`/intentions?i=${encodeURIComponent(counted.intentionId)}`}
                className="font-medium hover:underline"
              >
                {counted.name}
              </Link>
            ) : (
              <span className="font-medium">{counted.name}</span>
            )}
            {counted.isOverall && <Muted> · {t("listDetail.overall")}</Muted>}
          </DetailRow>
        ))}
        <FinePrint>{t("listDetail.countsFinePrint")}</FinePrint>
        {generated !== null && (
          <p className="mt-2.5 border-t pt-2.5 text-xs">
            <b className="font-semibold">{t("listDetail.generated")}</b> {t("listDetail.with")}{" "}
            {row.generatedWith === null ? t("listDetail.deletedIntention") : row.generatedWith.name}
            <span className="block text-muted-foreground">
              {t("listDetail.generatedMeta", {
                generator: generated.generator,
                pages: formatCount(generated.pages),
                allocation:
                  generated.allocation === null ? "" : t("listDetail.correctingAllocation"),
                date: formatDay(generated.at),
              })}
            </span>
          </p>
        )}
      </DetailCard>
      <DetailCard title={t("listDetail.mix", { name: mix.intention.name })}>
        <MixMeters mix={mix} hasTarget={row.list.targetPages !== null} />
        <FinePrint>
          {mix.isAllocation
            ? t("listDetail.allocationMix")
            : t("listDetail.categoryMix", {
                target:
                  row.list.targetPages === null
                    ? t("listDetail.pagesNoTarget")
                    : t("listDetail.target"),
                scope: mix.scope === null ? "" : t("listDetail.withinScope", { scope: mix.scope }),
              })}
        </FinePrint>
      </DetailCard>
    </>
  );
}

interface MemberRowProps {
  item: ListItem;
  href: string | undefined;
  actions: ReactNode;
}

function MemberRow({ item, href, actions }: MemberRowProps) {
  const { data: categories = [] } = useCategoriesQuery();
  const { document, iteration } = item;

  return (
    <DetailRow
      aside={
        <span className="flex flex-col-reverse items-end gap-1 @md:flex-row @md:items-start @md:gap-2">
          <span className="flex flex-col items-end gap-1">
            <span className="tabular-nums">
              {item.pages === null ? "—" : `${formatCount(item.pages)} pp`}
            </span>
            <StatusWithFootnote
              status={iterationStatusOf(iteration)}
              footnote={statusFootnoteOf(iteration)}
            />
          </span>
          {actions}
        </span>
      }
    >
      {href === undefined ? (
        <b className="font-semibold">{document.title}</b>
      ) : (
        <Link to={href} className="font-semibold hover:underline">
          {document.title}
        </Link>
      )}{" "}
      <span className="font-mono text-xs text-muted-foreground">
        {documentIdentifierOf(document)}
      </span>
      <div className="text-muted-foreground">
        {categoryLabelOf(categories, iteration.categoryId)}
      </div>
      <MemberFlag item={item} />
    </DetailRow>
  );
}

// At most one line: a stop someone decided, else a gate that fails, else a late copy.
function MemberFlag({ item }: { item: ListItem }) {
  const { t } = useTranslation("lists");
  const { cancellation } = item.iteration;
  if (cancellation?.cause === "NotDigitizable") {
    return (
      <div className="text-tone-red-foreground">
        {t("listDetail.notDigitized", { message: cancellation.publicText })}
      </div>
    );
  }

  if (cancellation !== null) {
    return (
      <div className="text-muted-foreground">
        {t("listDetail.cancelled", { message: cancellation.publicText })}
      </div>
    );
  }

  if (item.blocker !== null) {
    return (
      <div>
        <b className="font-semibold text-tone-amber-foreground">
          {t("listDetail.blocked", {
            blocker: t(blockerTexts[item.blocker].replace("lists:", "")),
          })}
        </b>{" "}
        <Muted>— {t("listDetail.blockedFoot")}</Muted>
      </div>
    );
  }

  if (item.lateCopy !== null && !isScanned(item.iteration)) {
    return (
      <div className="text-tone-amber-foreground">
        {t("listDetail.lateCopy", {
          source: item.lateCopy.source,
          state: item.lateCopy.state.toLowerCase(),
          date: formatDay(item.lateCopy.seenAt),
        })}
      </div>
    );
  }

  return null;
}

function StateNote({ detail, nameOf }: { detail: ListDetail; nameOf: (userId: string) => string }) {
  const { t } = useTranslation("lists");
  const { row, members } = detail;
  const { list } = row;
  const scanned = t("listDetail.scannedSoFar", {
    scanned: row.scannedItemCount,
    count: row.itemCount,
  });

  if (list.done !== null) {
    const published = members.filter((item) => item.iteration.progress === "Published").length;
    return (
      <StatusNote
        tone="green"
        className="mb-4"
        title={t("listDetail.doneTitle", {
          name: nameOf(list.done.actorId),
          date: formatDay(list.done.at),
        })}
      >
        {t("listDetail.doneBody", {
          scanned: row.scannedItemCount,
          published,
          refusedText:
            row.notDigitizableCount > 0
              ? t("listDetail.refusedCount", { count: row.notDigitizableCount })
              : "",
        })}
      </StatusNote>
    );
  }

  if (row.state === "Planned") {
    return (
      <StatusNote
        tone="blue"
        className="mb-4"
        title={t("listDetail.plannedTitle", { date: formatCalendarDay(list.startsOn) })}
      >
        {row.itemCount === 0
          ? t("listDetail.plannedEmpty")
          : t("listDetail.plannedBody", { count: row.itemCount })}
      </StatusNote>
    );
  }

  if (row.isOverdue) {
    return (
      <StatusNote
        tone="amber"
        className="mb-4"
        title={t("listDetail.overdueTitle", { date: formatCalendarDay(list.endsOn) })}
      >
        {t("listDetail.overdueBody", { scanned })}
      </StatusNote>
    );
  }

  return (
    <StatusNote
      tone="blue"
      className="mb-4"
      title={t("listDetail.inProgressTitle", { date: formatCalendarDay(list.startsOn) })}
    >
      {t("listDetail.inProgressBody", { date: formatCalendarDay(list.endsOn), scanned })}
    </StatusNote>
  );
}
