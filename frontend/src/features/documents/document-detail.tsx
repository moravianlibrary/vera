// One document's record beside the list (docs/demos/shared/page-documents.js renderWide and
// renderOwn). Staff read the toned note on what holds it, the facts, then a card for each part:
// who asked, existing copies, and for an attempt under way its defects, its adding, its
// digitization and the earlier attempts; then the catalog record and the history. A requester
// reads their own ask: its status in the public words, why they asked, and what has happened.
// What a caller may not read the server has already withheld; the cards gate only what they
// offer.
// Its acts sit beside the heading (document-actions.tsx).
// TODO(rrandiak): Ask for this too and Withdraw; Retry and Raw payload on Adding, Message on
// Digitization and Open in catalog; the cards' links check grants at any scope, not against
// custody or project; labels move to i18n.

import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { DocumentDetail } from "@/api/documents";
import type { Fact, Stat } from "@/components/detail-card";
import {
  DetailCard,
  DetailRow,
  FactGrid,
  FinePrint,
  Muted,
  StatTiles,
} from "@/components/detail-card";
import { navigationEntries, visibleNavigation } from "@/components/layout/navigation";
import {
  AskersCard,
  CatalogCard,
  CopiesCard,
  HistoryCard,
  RecordHeading,
} from "@/components/record-cards";
import { PriorityBadge, StatusBadge, ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { categoryPathOf } from "@/domain/categories";
import type { DocumentRecord } from "@/domain/documents";
import {
  batchIdOf,
  currentIterationOf,
  documentIdentifierOf,
  effectivePageCount,
  publicRecordStatusOf,
  recordStatusOf,
  requestsBy,
} from "@/domain/documents";
import type { Iteration, Session } from "@/domain/entities";
import { hasPermission } from "@/domain/permissions";
import {
  isProgressAtLeast,
  iterationStatusOf,
  outstandingDefects,
  validationOf,
} from "@/domain/status";
import type { StatusNote as StatusNoteParts } from "@/domain/status-notes";
import { deskOf, publicRecordNoteOf, staffRecordNoteOf } from "@/domain/status-notes";
import { DocumentActions } from "@/features/documents/document-actions";
import {
  useBatchesQuery,
  useCategoriesQuery,
  useDigitizationListsQuery,
  useProjectsQuery,
  useUsersQuery,
} from "@/hooks/use-reference-query";
import { formatDay } from "@/lib/format-date";
import { joinDetails } from "@/lib/join-details";

const categorySeparator = " / ";

interface DocumentDetailPaneProps {
  detail: DocumentDetail;
  session: Session;
}

export function DocumentDetailPane({ detail, session }: DocumentDetailPaneProps) {
  return (
    <article className="@container max-w-5xl">
      {detail.audience === "staff" ? (
        <StaffRecord detail={detail} session={session} />
      ) : (
        <OwnRecord detail={detail} session={session} />
      )}
    </article>
  );
}

// ---------------------------------------------------------------- staff

function StaffRecord({ detail, session }: DocumentDetailPaneProps) {
  const { record, log } = detail;
  const { document } = record;
  const current = currentIterationOf(record);
  const { data: users = [] } = useUsersQuery();
  const nameOf = (userId: string) => users.find((user) => user.id === userId)?.name ?? userId;
  const note = staffRecordNoteOf(record);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-4">
        <RecordHeading
          title={document.title}
          identifier={documentIdentifierOf(document)}
          details={[document.type, document.signature]}
        />
        <DocumentActions record={record} session={session} className="mb-4" />
      </div>
      {note !== null && <RecordNote note={note} nameOf={nameOf} />}
      <StaffFacts record={record} session={session} />

      <div className="mt-4 grid gap-4">
        <AskersCard
          record={record}
          users={users}
          action={
            record.requests.some((request) => request.decision === "Pending") &&
            hasPermission(session, "request.decide") && (
              <Button asChild size="sm" variant="outline">
                <Link to={`/review/proposals?id=${encodeURIComponent(document.id)}`}>
                  Decide in Proposals
                  <ArrowRight />
                </Link>
              </Button>
            )
          }
        />
        <CopiesCard record={record} nameOf={nameOf} />
        {current !== null && (
          <>
            <DefectsCard iteration={current} session={session} />
            <AddingCard record={record} iteration={current} nameOf={nameOf} session={session} />
            <DigitizationCard iteration={current} nameOf={nameOf} session={session} />
            <EarlierCard record={record} />
          </>
        )}
        <CatalogCard document={document} nameOf={nameOf} />
        <HistoryCard record={record} log={log} nameOf={nameOf} isPublic={false} />
      </div>
    </>
  );
}

function StaffFacts({ record, session }: { record: DocumentRecord; session: Session }) {
  const current = currentIterationOf(record);
  const { data: categories = [] } = useCategoriesQuery();
  const status = recordStatusOf(record);
  const statusStat: Stat = {
    label: "Status",
    value: status === null ? "—" : <StatusBadge status={status} />,
    isText: true,
  };
  const where = whereNowOf(record, session);

  if (current === null) {
    const askerCount = new Set(record.requests.map((request) => request.requesterId)).size;
    return <StatTiles stats={[statusStat, { label: "Askers", value: askerCount }, where]} />;
  }

  const pages = effectivePageCount(record.document);
  const categoryPath = categoryPathOf(categories, current.categoryId)
    .map((category) => category.name)
    .join(categorySeparator);
  return (
    <StatTiles
      stats={[
        statusStat,
        { label: "Category", value: categoryPath || current.categoryId, isText: true },
        { label: "Priority", value: <PriorityBadge priority={current.priority} />, isText: true },
        {
          label: "Page count",
          value: pages === null ? "—" : pages.value.toLocaleString("en-GB"),
          foot: pages === null ? "no source answered" : `${pages.source} · tier ${pages.tier}`,
        },
        where,
        { label: "Iteration", value: current.attempt },
      ]}
    />
  );
}

// The view whose queue holds it, as a link only for whoever may open that view.
function whereNowOf(record: DocumentRecord, session: Session): Stat {
  const label = "Where it is now";
  const desk = deskOf(record);
  if (desk === null) {
    return { label, value: "Nobody", isText: true };
  }

  if (desk === "documents") {
    const isFailed = currentIterationOf(record)?.progress === "IngestFailed";
    return {
      label,
      value: "Here",
      foot: isFailed ? "ingest failed" : "being added",
      isText: true,
    };
  }

  const reachable = visibleNavigation(session).find((entry) => entry.id === desk);
  const name = navigationEntries.find((entry) => entry.id === desk)?.label ?? desk;
  return {
    label,
    value:
      reachable === undefined ? (
        name
      ) : (
        <Link
          to={reachable.path}
          className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
        >
          {reachable.label}
          <ArrowRight className="size-3.5" />
        </Link>
      ),
    isText: true,
  };
}

// ---------------------------------------------------------------- cards

function DefectsCard({ iteration, session }: { iteration: Iteration; session: Session }) {
  const validation = validationOf(iteration);
  if (validation === "NotRequired" || validation === "Approved") {
    return null;
  }

  const outstanding = outstandingDefects(iteration);
  const denial = iteration.verdicts.findLast((verdict) => verdict.verdict === "Denied");
  return (
    <DetailCard
      title={`Defects — ${outstanding.length} outstanding`}
      action={
        hasPermission(session, "validation.approve") && (
          <Button asChild size="sm" variant="outline">
            <Link to="/review/documents">
              Resolve in Documents Validations
              <ArrowRight />
            </Link>
          </Button>
        )
      }
    >
      {outstanding.map((defect) => (
        <DetailRow key={defect.key}>
          <b className="font-semibold">
            {defect.plugin} {defect.ruleCode}
          </b>{" "}
          <Muted>{defect.subject}</Muted>
          <div className="text-muted-foreground">{defect.internalText ?? defect.publicText}</div>
        </DetailRow>
      ))}
      {validation === "Denied" && (
        <FinePrint>
          <b>Denied in review</b>
          {denial === undefined ? "" : `: ${denial.note}`}
        </FinePrint>
      )}
    </DetailCard>
  );
}

function AddingCard({
  record,
  iteration,
  nameOf,
  session,
}: {
  record: DocumentRecord;
  iteration: Iteration;
  nameOf: (userId: string) => string;
  session: Session;
}) {
  const canReadAdditions = hasPermission(session, "addition.read");
  const { data: batches = [] } = useBatchesQuery({ isEnabled: canReadAdditions });
  const batchId = batchIdOf(record);
  const batch = batches.find((candidate) => candidate.id === batchId);
  if (!canReadAdditions || batch === undefined) {
    return null;
  }

  const isFailed = iteration.progress === "IngestFailed";
  const ingest = isFailed ? (
    <ToneBadge tone="red">Failed</ToneBadge>
  ) : iteration.progress === "Enqueued" ? (
    <ToneBadge tone="slate">Waiting</ToneBadge>
  ) : (
    <ToneBadge tone="green">Ingested</ToneBadge>
  );

  return (
    <DetailCard title="Adding">
      <FactGrid
        facts={[
          {
            label: "Batch",
            value: (
              <>
                <span className="font-mono">{batch.id}</span> <Muted>{batch.name}</Muted>
              </>
            ),
          },
          {
            label: "Submitted",
            value: joinDetails([formatDay(batch.submittedAt), nameOf(batch.submittedBy)]),
          },
          { label: "Ingest", value: ingest },
          { label: "Attempts", value: iteration.ingestFailure?.attempts ?? 1 },
        ]}
      />
      {isFailed && (
        <StatusNote tone="red" className="mt-3" title="Could not be added">
          {iteration.ingestFailure?.error ?? "the error is not recorded."}
        </StatusNote>
      )}
      {isFailed && !hasPermission(session, "addition.retry") && (
        <FinePrint>
          Only an administrator can retry batch <b className="font-mono">{batch.id}</b>.
        </FinePrint>
      )}
    </DetailCard>
  );
}

function DigitizationCard({
  iteration,
  nameOf,
  session,
}: {
  iteration: Iteration;
  nameOf: (userId: string) => string;
  session: Session;
}) {
  const { data: projects = [] } = useProjectsQuery();
  // A curator sees the list an item is on, its name and dates, without list.read.
  const { data: lists = [] } = useDigitizationListsQuery();
  const project = projects.find((candidate) => candidate.id === iteration.projectId);
  const list = lists.find((candidate) => candidate.id === iteration.listId);
  const canOpenProjects =
    hasPermission(session, "project.read") || hasPermission(session, "project.decide");
  const { cancellation } = iteration;

  const facts: Fact[] = [
    {
      label: "Progress",
      value: (
        <>
          {iteration.progress}
          {cancellation !== null && <Muted> · held here</Muted>}
        </>
      ),
    },
    {
      label: "Project",
      value:
        project === undefined ? (
          "—"
        ) : canOpenProjects ? (
          <Link
            to={`/projects?id=${encodeURIComponent(project.id)}`}
            className="underline underline-offset-4"
          >
            {project.name}
          </Link>
        ) : (
          project.name
        ),
    },
    {
      label: "List",
      value:
        list !== undefined ? (
          <>
            {hasPermission(session, "list.read") ? (
              <Link to="/lists" className="underline underline-offset-4">
                {list.name}
              </Link>
            ) : (
              list.name
            )}{" "}
            <Muted>
              · {formatDay(list.startsOn)} → {formatDay(list.endsOn)}
            </Muted>
          </>
        ) : (
          (iteration.formerListName ?? "not on a list")
        ),
    },
  ];

  if (isProgressAtLeast(iteration.progress, "Digitized")) {
    facts.push({
      label: "Available at",
      value:
        iteration.publishedLink === null ? (
          <Muted>not set yet — setting it makes it Published</Muted>
        ) : (
          <a
            href={iteration.publishedLink}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            {iteration.publishedLink.replace(/^https?:\/\//, "")}
          </a>
        ),
    });
  }

  facts.push({
    label: "Cancelled",
    value:
      cancellation === null ? (
        <Muted>no</Muted>
      ) : (
        joinDetails([
          cancellation.cause === "Decided" ? "yes" : "could not be digitized",
          `${nameOf(cancellation.actorId)}, ${formatDay(cancellation.at)}`,
        ])
      ),
  });

  return (
    <DetailCard title="Digitization">
      <FactGrid facts={facts} />
    </DetailCard>
  );
}

function EarlierCard({ record }: { record: DocumentRecord }) {
  const earlier = record.iterations.slice(0, -1).toReversed();
  if (earlier.length === 0) {
    return null;
  }

  return (
    <DetailCard title={`Earlier iterations — ${earlier.length}`}>
      {earlier.map((iteration) => (
        <DetailRow key={iteration.id} aside={<StatusBadge status={iterationStatusOf(iteration)} />}>
          <b className="font-semibold">Iteration {iteration.attempt}</b>{" "}
          <Muted>
            {joinDetails([
              iteration.formerListName,
              iteration.scanDpi === null ? null : `${iteration.scanDpi} dpi`,
              `digitized ${iteration.digitizedAt === null ? "—" : formatDay(iteration.digitizedAt)}`,
            ])}
          </Muted>
        </DetailRow>
      ))}
    </DetailCard>
  );
}

// ---------------------------------------------------------------- requester

function OwnRecord({ detail, session }: DocumentDetailPaneProps) {
  const { record, log } = detail;
  const { document } = record;
  const userId = session.user.id;
  const [latest] = requestsBy(record, userId);
  const status = publicRecordStatusOf(record, userId);
  const note = publicRecordNoteOf(record, userId);
  const readingLink = readingLinkOf(record);

  return (
    <>
      <RecordHeading
        title={document.title}
        identifier={documentIdentifierOf(document)}
        details={[latest === undefined ? null : `asked ${formatDay(latest.at)}`]}
      />
      {note !== null && <RecordNote note={note} nameOf={() => ""} />}
      <StatTiles
        stats={[
          {
            label: "Status",
            value: status === null ? "—" : <StatusBadge status={status} />,
            isText: true,
          },
          {
            label: "Asked",
            value: latest === undefined ? "—" : formatDay(latest.at),
            isText: true,
          },
          {
            label: "Read it",
            value:
              readingLink === null ? (
                "Not yet"
              ) : (
                <a
                  href={readingLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-4"
                >
                  Read it in {readingLink.source}
                  <ArrowUpRight className="size-3.5" />
                </a>
              ),
            isText: true,
          },
        ]}
      />

      <div className="mt-4 grid gap-4">
        {latest !== undefined && latest.reason !== null && (
          <DetailCard title="Why I asked">
            <p>{latest.reason}</p>
            <FinePrint>Only you and the curator deciding read this.</FinePrint>
          </DetailCard>
        )}
        <HistoryCard record={record} log={log} nameOf={() => ""} isPublic />
      </div>
    </>
  );
}

// A requester is offered content or nothing: a registry's link to the scan, or VERA's own.
function readingLinkOf(record: DocumentRecord): { source: string; url: string } | null {
  const content = record.document.registryRecords.find(
    (entry) => entry.linkKind === "content" && entry.url !== null,
  );
  if (content !== undefined && content.url !== null) {
    return { source: content.registry, url: content.url };
  }

  const publishedLink = record.iterations.findLast(
    (iteration) => iteration.publishedLink !== null,
  )?.publishedLink;
  return publishedLink === undefined || publishedLink === null
    ? null
    : { source: "VERA", url: publishedLink };
}

// ---------------------------------------------------------------- shared

function RecordNote({
  note,
  nameOf,
}: {
  note: StatusNoteParts;
  nameOf: (userId: string) => string;
}) {
  const title: ReactNode =
    note.actedBy === null
      ? note.title
      : `${note.title} by ${nameOf(note.actedBy.actorId)}, ${formatDay(note.actedBy.at)}`;
  return (
    <StatusNote tone={note.tone} title={title} className="mb-4">
      {note.text}
    </StatusNote>
  );
}
