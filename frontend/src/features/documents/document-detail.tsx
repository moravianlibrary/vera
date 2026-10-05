// One document's record beside the list (docs/demos/shared/page-documents.js renderWide and
// renderOwn). Staff read the toned note on what holds it, the facts, then a card for each part:
// who asked, existing copies, and for an attempt under way its defects, its adding, its
// digitization and the earlier attempts; then the catalog record and the history. A requester
// reads their own ask: its status in the public words, why they asked, and what has happened.
// What a caller may not read the server has already withheld; the cards gate only what they
// offer.
// TODO(rrandiak): the pane's actions (Ask for this too, Withdraw, More), Retry and Raw payload
// on Adding, Message on Digitization and Open in catalog; grants are checked at any scope, not
// against custody or project; labels move to i18n.

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
import type { Tone } from "@/components/status-badge";
import { PriorityBadge, RegistryBadge, StatusBadge, ToneBadge } from "@/components/status-badge";
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
import type {
  Actor,
  Document,
  ExistingCopy,
  Iteration,
  Request,
  Session,
  StatusLogEntry,
  User,
} from "@/domain/entities";
import { hasPermission } from "@/domain/permissions";
import {
  isProgressAtLeast,
  iterationStatusOf,
  outstandingDefects,
  validationOf,
} from "@/domain/status";
import type { Desk, StatusNote as StatusNoteParts } from "@/domain/status-notes";
import { deskOf, publicRecordNoteOf, staffRecordNoteOf } from "@/domain/status-notes";
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
      <RecordHeading
        title={document.title}
        identifier={documentIdentifierOf(document)}
        details={[document.type, document.signature]}
      />
      {note !== null && <RecordNote note={note} nameOf={nameOf} />}
      <StaffFacts record={record} session={session} />

      <div className="mt-4 grid gap-4">
        <AskersCard record={record} users={users} session={session} />
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
    return (
      <StatTiles
        stats={[
          statusStat,
          { label: "Askers", value: askerCount, foot: "decided together" },
          where,
        ]}
      />
    );
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
        {
          label: "Iteration",
          value: current.attempt,
          foot: record.iterations.length > 1 ? "earlier ones below" : "the first attempt",
        },
      ]}
    />
  );
}

const deskFeet = {
  documents: "being added",
  proposals: "whose desk it is on",
  validations: "whose desk it is on",
  lists: "whose desk it is on",
} as const satisfies Record<Desk, string>;

// The view whose queue holds it, as a link only for whoever may open that view.
function whereNowOf(record: DocumentRecord, session: Session): Stat {
  const label = "Where it is now";
  const desk = deskOf(record);
  if (desk === null) {
    return { label, value: "Nobody", foot: "nothing is waiting on anyone", isText: true };
  }

  if (desk === "documents") {
    const isFailed = currentIterationOf(record)?.progress === "IngestFailed";
    return {
      label,
      value: "Here",
      foot: isFailed ? "ingest failed — an administrator retries it" : deskFeet.documents,
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
    foot: deskFeet[desk],
    isText: true,
  };
}

// ---------------------------------------------------------------- cards

function AskersCard({
  record,
  users,
  session,
}: {
  record: DocumentRecord;
  users: readonly User[];
  session: Session;
}) {
  const current = currentIterationOf(record);
  const { data: projects = [] } = useProjectsQuery();
  const requests = record.requests.toSorted((first, second) => second.at.localeCompare(first.at));
  const askerCount = new Set(record.requests.map((request) => request.requesterId)).size;
  const isPending = record.requests.some((request) => request.decision === "Pending");
  const isFollowed = record.requests.some(isFollowing);

  return (
    <DetailCard title={`Asked by ${askerCount}`}>
      {requests.map((request) => {
        const user = users.find((candidate) => candidate.id === request.requesterId);
        const project = projects.find((candidate) => candidate.id === request.projectId);
        return (
          <DetailRow key={request.id} aside={<Muted>{formatDay(request.at)}</Muted>}>
            <b className="font-semibold">{user?.name ?? request.requesterId}</b>{" "}
            {user?.kind === "agent" && <ToneBadge tone="purple">agent</ToneBadge>}{" "}
            <AskTag request={request} record={record} />
            {request.reason !== null && (
              <div className="text-muted-foreground">“{request.reason}”</div>
            )}
            {project !== undefined && current === null && (
              <div className="text-muted-foreground">
                for {project.name}
                {request.decision === "Pending" && request.isAfterProjectApproval
                  ? ", after its approval"
                  : ""}
              </div>
            )}
            {request.decision === "Pending" && request.approveOnCheck !== null && (
              <div className="text-muted-foreground">asked for approval on arrival</div>
            )}
          </DetailRow>
        );
      })}
      {isPending && (
        <FinePrint>
          One decision covers every asker.{" "}
          {hasPermission(session, "request.decide") && (
            <Link to="/review/proposals" className="underline underline-offset-4">
              Decide it in Proposals →
            </Link>
          )}
        </FinePrint>
      )}
      {isFollowed && (
        <FinePrint>
          A later asker <b>follows</b> the work already moving rather than duplicating it — none of
          them sees the word “duplicate”.
        </FinePrint>
      )}
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
  const current = currentIterationOf(record);
  const tag = (tone: Tone, label: string) => <ToneBadge tone={tone}>{label}</ToneBadge>;

  if (isFollowing(request)) {
    return tag("slate", "following");
  }

  if (request.decision === "Pending") {
    return tag("amber", "awaiting review");
  }

  if (request.decision === "Denied") {
    return tag("red", "declined");
  }

  if (request.decision === "Withdrawn") {
    return tag("slate", "withdrawn");
  }

  if (request.decision !== "Approved" || request.iteration === null) {
    return tag("slate", "being added");
  }

  const iterationId = request.iteration.id;
  if (iterationId === current?.id) {
    return tag("blue", "originated");
  }

  const attempt = record.iterations.find((iteration) => iteration.id === iterationId)?.attempt;
  return tag("slate", `iteration ${attempt ?? 1}`);
}

function CopiesCard({
  record,
  nameOf,
}: {
  record: DocumentRecord;
  nameOf: (userId: string) => string;
}) {
  const copies = distinctCopiesOf(record.requests);
  const registries = record.document.registryRecords.filter((entry) => entry.state !== "NotFound");
  const rescan = record.requests.find(
    (request) => request.decision === "Approved" && request.rescan !== null,
  );
  const isFoundAfterApproval = copies.some((copy) => copy.foundAfterApproval);

  if (copies.length === 0 && registries.length === 0) {
    return (
      <DetailCard title="Existing copies">
        <p className="text-xs text-muted-foreground">
          No copy anywhere VERA looks. Nothing to decide over.
        </p>
      </DetailCard>
    );
  }

  return (
    <DetailCard title="Existing copies">
      {copies.map((copy) => (
        <DetailRow
          key={`${copy.source}-${copy.iterationId}`}
          aside={<CopyBadge copy={copy} record={record} />}
        >
          <b className="font-semibold">{copy.source}</b>{" "}
          <Muted>
            seen {formatDay(copy.seenAt)}
            {copy.foundAfterApproval ? " · after approval" : ""}
          </Muted>
        </DetailRow>
      ))}
      {rescan?.decision === "Approved" && rescan.rescan !== null && (
        <StatusNote
          tone="blue"
          className="mt-2"
          title={`Approved as rescan by ${nameOf(rescan.rescan.actorId)}, ${formatDay(rescan.rescan.at)}`}
        >
          {rescan.rescan.note}
        </StatusNote>
      )}
      {isFoundAfterApproval && rescan === undefined && (
        <FinePrint>
          <b>Found after approval</b>, so nobody decided over it. It is flagged in the list editor's
          pool, so it is never listed unseen.
        </FinePrint>
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
                  ? `unreachable — last answer ${formatDay(entry.observedAt)}`
                  : `observed ${formatDay(entry.observedAt)}`}
              </Muted>
            </DetailRow>
          ))}
          <FinePrint>Registry answers are evidence: shown as the registry said them.</FinePrint>
        </div>
      )}

      {copies.length > 0 && rescan === undefined && !isFoundAfterApproval && (
        <FinePrint>
          A copy blocks nothing. Approving over it is a <b>rescan</b> — decided in Proposals, one
          item at a time.
        </FinePrint>
      )}
    </DetailCard>
  );
}

// Every ask records the copies its check found; the same copy found twice is one copy.
function distinctCopiesOf(requests: readonly Request[]): ExistingCopy[] {
  const copies = new Map<string, ExistingCopy>();
  for (const copy of requests.flatMap((request) => request.existingCopies)) {
    copies.set(`${copy.source}-${copy.iterationId}`, copy);
  }

  return [...copies.values()];
}

function CopyBadge({ copy, record }: { copy: ExistingCopy; record: DocumentRecord }) {
  const attempt = record.iterations.find((iteration) => iteration.id === copy.iterationId)?.attempt;
  const label = attempt === undefined ? copy.state : `${copy.state} · iteration ${attempt}`;
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
      <FinePrint>
        Read-only here — accepting a defect is a decision, and deciding happens in Documents
        Validations.
      </FinePrint>
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
      {isFailed && (
        <FinePrint>
          {hasPermission(session, "addition.retry") ? (
            "A failed ingest is retried, never deleted."
          ) : (
            <>
              Only an administrator can retry this. Ask about{" "}
              <b className="font-mono">{batch.id}</b> — the batch is the unit they retry.
            </>
          )}
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
      <FinePrint>
        One document, several attempts. The row shows the current one; the earlier scans stay here,
        and are the <b>VERA</b> copy a rescan was decided over.
      </FinePrint>
    </DetailCard>
  );
}

const unitTypeLabels = {
  "volume-name": "volume-name",
  "volume-number": "volume-number",
  barcode: "barcode",
} as const satisfies Record<NonNullable<Document["unit"]>["type"], string>;

function CatalogCard({
  document,
  nameOf,
}: {
  document: Document;
  nameOf: (userId: string) => string;
}) {
  const inUse = effectivePageCount(document);
  const pageSources = document.pageSources.toSorted((first, second) => second.tier - first.tier);

  return (
    <DetailCard title="Catalog record">
      <FactGrid
        facts={[
          { label: "Type", value: document.type },
          {
            label: "Unit",
            value:
              document.unit === null ? (
                "whole record"
              ) : (
                <>
                  {document.unit.value} <Muted>({unitTypeLabels[document.unit.type]})</Muted>
                </>
              ),
          },
          { label: "Signature", value: document.signature ?? "—" },
          { label: "Catalog ID", value: <span className="font-mono">{document.catalogId}</span> },
        ]}
      />
      <div className="mt-3.5">
        {pageSources.length === 0 ? (
          <FinePrint>No source answered a page count — that is a defect, not a blank.</FinePrint>
        ) : (
          pageSources.map((source) => (
            <DetailRow
              key={source.source}
              aside={
                <span className="tabular-nums">
                  {source.value.toLocaleString("en-GB")}{" "}
                  {source === inUse && <ToneBadge tone="green">in use</ToneBadge>}
                </span>
              }
            >
              Pages — {source.source}{" "}
              <Muted>
                {joinDetails([
                  `tier ${source.tier}`,
                  source.setBy === null ? null : nameOf(source.setBy),
                ])}
              </Muted>
            </DetailRow>
          ))
        )}
      </div>
    </DetailCard>
  );
}

interface HistoryEvent {
  key: string;
  at: string;
  event: string;
  detail: string | null;
  actor: Actor;
}

// The status log, with the asks it does not hold, newest first.
function HistoryCard({
  record,
  log,
  nameOf,
  isPublic,
}: {
  record: DocumentRecord;
  log: readonly StatusLogEntry[];
  nameOf: (userId: string) => string;
  isPublic: boolean;
}) {
  const asks: HistoryEvent[] = record.requests.map((request) => ({
    key: `asked-${request.id}`,
    at: request.at,
    event: "Asked for",
    detail: null,
    actor: { kind: "user", userId: request.requesterId },
  }));
  const events = [...log.map((entry) => ({ ...entry, key: entry.id })), ...asks].toSorted(
    (first, second) => second.at.localeCompare(first.at),
  );
  const actorName = (actor: Actor) =>
    actor.kind === "user" ? nameOf(actor.userId) : actor.kind === "system" ? "System" : null;

  return (
    <DetailCard title={isPublic ? "What has happened" : "History"}>
      {events.map((entry) => (
        <DetailRow
          key={entry.key}
          aside={
            <Muted>
              {joinDetails([formatDay(entry.at), isPublic ? null : actorName(entry.actor)])}
            </Muted>
          }
        >
          <b className="font-semibold">{entry.event}</b>
          {!isPublic && entry.detail !== null && (
            <div className="text-muted-foreground">{entry.detail}</div>
          )}
        </DetailRow>
      ))}
      <FinePrint>Provenance lives in the history, not in a box of its own.</FinePrint>
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
            foot: "the same words a notification carries",
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
            foot:
              readingLink === null
                ? "you get a link the moment there is one"
                : "somewhere you can read it now",
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

function RecordHeading({
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
