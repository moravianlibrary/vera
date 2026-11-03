// The cards a record is read through, shared by every view that shows a document: who asked,
// the existing copies, the catalog record and the history, under the record's heading
// (docs/demos/shared/page-documents.js and page-proposals.js). Each takes the record as the
// server sent it, already withheld to what the caller may read.
// The catalog record links out when the caller passes the catalog adapter's link (DEC-0006).

import type { DocumentRecord } from "@vera/domain/documents";
import { currentIterationOf, effectivePageCount, existingCopiesOf } from "@vera/domain/documents";
import type {
  Actor,
  Document,
  ExistingCopy,
  Request,
  StatusLogEntry,
  User,
} from "@vera/domain/entities";
import type { SourcedValue } from "@vera/domain/properties";
import { valuesOf } from "@vera/domain/properties";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { DetailCard, DetailRow, FactGrid, Muted } from "@/components/detail-card";
import { existingCopyLabels } from "@/components/filters/value-labels";
import type { Tone } from "@/components/status-badge";
import { RegistryBadge, ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { useIsShownBatch, useProjectsQuery } from "@/hooks/use-reference-query";
import { i18n } from "@/i18n";
import { publicWordingOf, wordingOf } from "@/lib/event-wording";
import { formatDay, formatLongDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { joinDetails } from "@/lib/join-details";

// Who asked, newest first: each ask's reason, its project before approval and its batch.
export function AskersCard({
  record,
  users,
  action,
}: {
  record: DocumentRecord;
  users: readonly User[];
  action?: ReactNode;
}) {
  const { t } = useTranslation("common");
  const current = currentIterationOf(record);
  const { data: projects = [] } = useProjectsQuery();
  const isShownBatch = useIsShownBatch();
  const requests = record.requests.toSorted((first, second) => second.at.localeCompare(first.at));
  const askerCount = new Set(record.requests.map((request) => request.requesterId)).size;

  return (
    <DetailCard title={t("recordCards.askedBy", { count: askerCount })} action={action}>
      {requests.map((request) => {
        const user = users.find((candidate) => candidate.id === request.requesterId);
        const project = projects.find((candidate) => candidate.id === request.projectId);
        return (
          <DetailRow
            key={request.id}
            aside={
              <Muted>
                {formatDay(request.at)}
                {isShownBatch(request.batchId) && (
                  <span className="block font-mono">{request.batchId}</span>
                )}
              </Muted>
            }
          >
            <b className="font-semibold">{user?.name ?? request.requesterId}</b>{" "}
            {user?.kind === "agent" && <ToneBadge tone="purple">{t("badge.agent")}</ToneBadge>}{" "}
            <AskTag request={request} record={record} />
            {request.reason !== null && (
              <div className="text-muted-foreground">“{request.reason}”</div>
            )}
            {project !== undefined && (current === null || request.decision === "Pending") && (
              <div className="text-muted-foreground">
                {t("recordCards.forProject", { name: project.name })}
                {request.decision === "Pending" && request.isAfterProjectApproval
                  ? t("recordCards.afterApprovalSuffix")
                  : ""}
              </div>
            )}
          </DetailRow>
        );
      })}
    </DetailCard>
  );
}

function isFollowing(request: Request): boolean {
  return (
    request.decision === "Duplicate" ||
    (request.decision === "Approved" && request.iteration?.relation === "Tracks")
  );
}

function AskTag({ request, record }: { request: Request; record: DocumentRecord }) {
  const { t } = useTranslation("common");
  const current = currentIterationOf(record);
  const tag = (tone: Tone, label: string) => <ToneBadge tone={tone}>{label}</ToneBadge>;

  if (isFollowing(request)) {
    return tag("slate", t("recordCards.following"));
  }

  if (request.decision === "Pending") {
    return tag("amber", t("recordCards.awaitingDecision"));
  }

  if (request.decision === "Denied") {
    return tag("red", t("recordCards.declined"));
  }

  if (request.decision === "Withdrawn") {
    return tag("slate", t("recordCards.withdrawn"));
  }

  if (request.decision !== "Approved" || request.iteration === null) {
    return tag("slate", t("recordCards.beingAdded"));
  }

  const iterationId = request.iteration.id;
  if (iterationId === current?.id) {
    return tag("blue", t("recordCards.originated"));
  }

  const attempt = record.iterations.find((iteration) => iteration.id === iterationId)?.attempt;
  return tag("slate", t("recordCards.iteration", { count: attempt ?? 1 }));
}

// The copies the checks found, a rescan approved over them, and what each registry answered.
export function CopiesCard({
  record,
  nameOf,
}: {
  record: DocumentRecord;
  nameOf: (userId: string) => string;
}) {
  const { t } = useTranslation("common");
  const copies = existingCopiesOf(record.requests);
  const registries = record.document.registryRecords.filter((entry) => entry.state !== "NotFound");
  const rescan = record.requests.find(
    (request) => request.decision === "Approved" && request.rescan !== null,
  );

  if (copies.length === 0 && registries.length === 0) {
    const isChecking = record.requests.some(
      (request) => request.decision === "Pending" && request.checkedAt === null,
    );
    return (
      <DetailCard title={t("recordCards.existingCopies")}>
        <p className="text-xs text-muted-foreground">
          {isChecking ? t("recordCards.notCheckedYet") : t("recordCards.noCopyFound")}
        </p>
      </DetailCard>
    );
  }

  return (
    <DetailCard title={t("recordCards.existingCopies")}>
      {copies.map((copy) => (
        <DetailRow
          key={`${copy.source}-${copy.iterationId}`}
          aside={<CopyBadge copy={copy} record={record} />}
        >
          <b className="font-semibold">{copy.source}</b>{" "}
          <Muted>
            {t(
              copy.foundAfterApproval
                ? "recordCards.copySeenAfterApproval"
                : "recordCards.copySeen",
              { date: formatLongDay(copy.seenAt) },
            )}
          </Muted>
        </DetailRow>
      ))}
      {rescan?.decision === "Approved" && rescan.rescan !== null && (
        <StatusNote
          tone="blue"
          className="mt-2"
          title={t("recordCards.approvedRescan", {
            name: nameOf(rescan.rescan.actorId),
            date: formatLongDay(rescan.rescan.at),
          })}
        >
          {rescan.rescan.note}
        </StatusNote>
      )}

      {registries.length > 0 && (
        <div className="mt-3">
          {registries.map((entry) => (
            <DetailRow
              key={entry.registry}
              aside={
                entry.url === null ? (
                  <RegistryBadge record={entry} />
                ) : (
                  <a href={entry.url} target="_blank" rel="noopener noreferrer">
                    <RegistryBadge record={entry} className="hover:underline" />
                  </a>
                )
              }
            >
              {entry.registry}{" "}
              <Muted>
                {entry.state === "CheckFailed"
                  ? t("recordCards.registryUnreachable", { date: formatLongDay(entry.observedAt) })
                  : t("recordCards.registryObserved", { date: formatLongDay(entry.observedAt) })}
              </Muted>
            </DetailRow>
          ))}
        </div>
      )}
    </DetailCard>
  );
}

function CopyBadge({ copy, record }: { copy: ExistingCopy; record: DocumentRecord }) {
  const attempt = record.iterations.find((iteration) => iteration.id === copy.iterationId)?.attempt;
  const state = i18n.t(existingCopyLabels[copy.state]);
  const label =
    attempt === undefined
      ? state
      : `${state} · ${i18n.t("recordCards.iteration", { ns: "common", count: attempt })}`;
  if (copy.link === null) {
    return <ToneBadge tone="purple">{label}</ToneBadge>;
  }

  return (
    <a href={copy.link} target="_blank" rel="noopener noreferrer">
      <ToneBadge tone="purple" className="hover:underline">
        {label} <ArrowUpRight />
      </ToneBadge>
    </a>
  );
}

const unitTypeLabels = {
  "volume-name": "common:recordCards.unitVolumeName",
  "volume-number": "common:recordCards.unitVolumeNumber",
  barcode: "common:recordCards.unitBarcode",
} as const satisfies Record<NonNullable<Document["unit"]>["type"], string>;

// The title, type and shelf mark come from the catalog adapter, each with its sources
// (DOC-property-predefined); one row says it for all three when they were read together.
const catalogFactLabels = [
  ["material_type", "recordCards.type"],
  ["shelf_mark", "recordCards.shelfMark"],
  ["title", "recordCards.title"],
] as const;

function catalogFactSourcesOf(document: Document) {
  const rows = new Map<string, { what: string[]; name: string; source: SourcedValue }>();
  for (const [key, labelKey] of catalogFactLabels) {
    const label = i18n.t(labelKey, { ns: "common" });
    for (const source of valuesOf(document.properties, key)?.sources ?? []) {
      const name =
        source.source.kind === "hand"
          ? i18n.t("recordCards.byHand", { ns: "common" })
          : source.source.instanceName;
      const rowKey = `${name}|${source.tier}|${source.observedAt}`;
      const row = rows.get(rowKey) ?? { what: [], name, source };
      row.what.push(label);
      rows.set(rowKey, row);
    }
  }

  return [...rows.entries()].map(([key, row]) => ({ ...row, key, what: joinWords(row.what) }));
}

// "Type", "Type and title", "Type, shelf mark and title".
function joinWords(words: readonly string[]): string {
  const [first = "", second = "", third = ""] = words.map((word, index) =>
    index === 0 ? word : word.toLocaleLowerCase(i18n.language),
  );
  return i18n.t(`recordCards.factList_${words.length}`, {
    ns: "common",
    first,
    second,
    third,
  });
}

export function CatalogCard({
  document,
  nameOf,
  link,
}: {
  document: Document;
  nameOf: (userId: string) => string;
  // Where the record opens in the catalog, to repair it there.
  link?: string | null;
}) {
  const { t } = useTranslation("common");
  const inUse = effectivePageCount(document);
  const pageSources = document.pageSources.toSorted((first, second) => second.tier - first.tier);
  const catalogSources = catalogFactSourcesOf(document);

  return (
    <DetailCard
      title={t("recordCards.catalogRecord")}
      action={
        link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium underline-offset-4 hover:underline"
          >
            {t("recordCards.openCatalog")}
          </a>
        ) : undefined
      }
    >
      <FactGrid
        facts={[
          { label: t("recordCards.type"), value: document.type },
          {
            label: t("recordCards.unit"),
            value:
              document.unit === null ? (
                t("recordCards.wholeRecord")
              ) : (
                <>
                  {document.unit.value}{" "}
                  <Muted>({i18n.t(unitTypeLabels[document.unit.type])})</Muted>
                </>
              ),
          },
          { label: t("recordCards.shelfMark"), value: document.shelfMark ?? "—" },
          {
            label: t("recordCards.catalogId"),
            value: <span className="font-mono">{document.catalogId}</span>,
          },
        ]}
      />
      <div className="mt-3.5">
        {pageSources.length === 0 ? (
          <p className="text-muted-foreground">{t("recordCards.noPageCount")}</p>
        ) : (
          pageSources.map((source) => (
            <DetailRow
              key={source.source}
              aside={
                <span className="tabular-nums">
                  {formatCount(source.value)}{" "}
                  {source === inUse && <ToneBadge tone="green">{t("recordCards.inUse")}</ToneBadge>}
                </span>
              }
            >
              {t("recordCards.pagesSource", { source: source.source })}{" "}
              <Muted>
                {joinDetails([
                  t("recordCards.tier", { count: source.tier }),
                  source.setBy === null ? null : nameOf(source.setBy),
                ])}
              </Muted>
            </DetailRow>
          ))
        )}
      </div>
      {catalogSources.length > 0 && (
        <div className="mt-3.5">
          {catalogSources.map((row) => (
            <DetailRow key={row.key}>
              {t("recordCards.factSources", { facts: row.what, source: row.name })}{" "}
              <Muted>
                {joinDetails([
                  t("recordCards.tier", { count: row.source.tier }),
                  t("recordCards.observed", { date: formatLongDay(row.source.observedAt) }),
                  row.source.setBy === null ? null : nameOf(row.source.setBy),
                ])}
              </Muted>
            </DetailRow>
          ))}
        </div>
      )}
    </DetailCard>
  );
}

// The status log, newest first.
export function HistoryCard({
  log,
  nameOf,
  isPublic,
}: {
  log: readonly StatusLogEntry[];
  nameOf: (userId: string) => string;
  isPublic: boolean;
}) {
  const { t } = useTranslation("common");
  const events = log.toSorted((first, second) => second.at.localeCompare(first.at));
  const actorName = (actor: Actor) =>
    actor.kind === "user"
      ? nameOf(actor.userId)
      : actor.kind === "system"
        ? t("recordCards.system")
        : null;

  return (
    <DetailCard title={isPublic ? t("recordCards.whatHappened") : t("recordCards.history")}>
      {events.length === 0 && <Muted>{t("recordCards.nothingRecorded")}</Muted>}
      {events.map((entry) => (
        <DetailRow
          key={entry.id}
          aside={
            <Muted>
              {joinDetails([formatLongDay(entry.at), isPublic ? null : actorName(entry.actor)])}
            </Muted>
          }
        >
          {isPublic ? (
            <b className="font-semibold">{publicWordingOf(entry.code)}</b>
          ) : (
            (() => {
              const wording = wordingOf(entry, nameOf);
              return (
                <>
                  <b className="font-semibold">{wording.title}</b>
                  {wording.line && <div className="text-muted-foreground">{wording.line}</div>}
                  {entry.reason.internal && (
                    <div className="text-muted-foreground">{entry.reason.internal}</div>
                  )}
                  {entry.reason.public && (
                    <div className="text-muted-foreground">
                      Told the asker: {entry.reason.public}
                    </div>
                  )}
                </>
              );
            })()
          )}
        </DetailRow>
      ))}
    </DetailCard>
  );
}

export function RecordHeading({
  title,
  identifier,
  details,
}: {
  title: string;
  identifier: string;
  details: readonly (string | null)[];
}) {
  const detailLine = joinDetails(details);
  return (
    <header className="mb-4">
      <h2 className="text-xl leading-7 font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="font-mono">{identifier}</span>
        {detailLine !== "" && ` · ${detailLine}`}
      </p>
    </header>
  );
}
