// One document's record beside the list (docs/demos/shared/page-documents.js renderWide and
// renderOwn). Staff read the toned note on what holds it, the facts, then a card for each part:
// who asked, existing copies, and for an attempt under way its defects, its adding, its
// digitization and the earlier attempts; then the catalog record and the history. A requester
// reads their own ask: its status in the public words, why they asked, and what has happened.
// What a caller may not read the server has already withheld; the cards gate only what they
// offer.
// Its acts sit beside the heading (document-actions.tsx); a requester's is withdrawing their ask.
// TODO(rrandiak): Ask for this too; Retry and Raw payload on Adding, Message on
// Digitization and Open in catalog; the cards' links check grants at any scope, not against
// custody or project; labels move to i18n.

import type { DocumentDetail } from "@vera/contract/documents";
import type { Publication } from "@vera/contract/iterations";
import { categoryPathOf } from "@vera/domain/categories";
import type { DocumentRecord } from "@vera/domain/documents";
import {
  batchIdOf,
  currentIterationOf,
  documentIdentifierOf,
  effectivePageCount,
  isShownAsBatch,
  latestPublicAskOf,
  publicRecordStatusOf,
  recordStatusOf,
} from "@vera/domain/documents";
import type { Iteration, Session } from "@vera/domain/entities";
import { primaryLinkOf, scopeOfIteration } from "@vera/domain/iterations";
import { can, hasPermission } from "@vera/domain/permissions";
import { scopeOfProject } from "@vera/domain/projects";
import {
  isProgressAtLeast,
  iterationStatusOf,
  outstandingDefects,
  validationOf,
} from "@vera/domain/status";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router";
import { z } from "zod";
import { makeLinkPrimary, removeLink, replaceLink } from "@/api/iterations";
import { Field } from "@/components/classification-fields";
import type { Fact, Stat } from "@/components/detail-card";
import {
  DetailCard,
  DetailRow,
  FactGrid,
  FinePrint,
  Muted,
  StatTiles,
} from "@/components/detail-card";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { MessageDialog } from "@/components/dialogs/message-dialog";
import { FieldError } from "@/components/iteration-dialogs";
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
import { Input } from "@/components/ui/input";
import { DocumentActions, iterationInvalidations } from "@/features/documents/document-actions";
import { RetryFailedButton } from "@/features/documents/document-group-header";
import { PropertiesCard } from "@/features/properties/properties-card";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useMessageChannelsQuery } from "@/hooks/use-message-query";
import { useReferenceLabels } from "@/hooks/use-reference-labels";
import {
  useBatchesQuery,
  useCategoriesQuery,
  useDigitizationListsQuery,
  usePluginInstancesQuery,
  useProjectsQuery,
  useUsersQuery,
} from "@/hooks/use-reference-query";
import { formatDay } from "@/lib/format-date";
import { joinDetails } from "@/lib/join-details";
import type { StatusNote as StatusNoteParts } from "@/lib/status-notes";
import { deskOf, publicRecordNoteOf, staffRecordNoteOf } from "@/lib/status-notes";

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
  const { data: pluginInstances = [] } = usePluginInstancesQuery();
  const note = staffRecordNoteOf(
    record,
    (id) => pluginInstances.find((instance) => instance.id === id)?.name ?? id,
  );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-4">
        <RecordHeading
          title={document.title}
          identifier={documentIdentifierOf(document)}
          details={[document.type, document.shelfMark]}
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
                <Link to={`/requests?id=${encodeURIComponent(document.id)}`}>
                  Decide in Requests
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
            <DigitizationCard
              iteration={current}
              title={document.title}
              nameOf={nameOf}
              session={session}
            />
            <EarlierCard record={record} />
          </>
        )}
        <CatalogCard document={document} nameOf={nameOf} />
        <PropertiesCard record={record} audience="staff" nameOf={nameOf} />
        <HistoryCard log={log} nameOf={nameOf} isPublic={false} />
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
  const references = useReferenceLabels(["pluginInstances"]);
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
            <Link to={`/review/documents?id=${encodeURIComponent(iteration.id)}`}>
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
            {references.pluginInstances(defect.instanceId)} {defect.ruleCode}
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
  const canReadAdditions = hasPermission(session, "request.read_ingest");
  const { data: batches = [] } = useBatchesQuery({ isEnabled: canReadAdditions });
  const batchId = batchIdOf(record);
  const batch = batches.find((candidate) => candidate.id === batchId);
  if (!canReadAdditions || batch === undefined) {
    return null;
  }

  // A batch of one is not named: it is retried from here, a larger one from its header
  // (ENT-batch, ACT-retry-batch).
  const isShown = isShownAsBatch(batch);
  const isFailed = iteration.progress === "IngestFailed";
  const canRetry = hasPermission(session, "request.retry");
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
          ...(isShown
            ? [
                {
                  label: "Batch",
                  value: (
                    <>
                      <span className="font-mono">{batch.id}</span> <Muted>{batch.name}</Muted>
                    </>
                  ),
                },
              ]
            : []),
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
      {isFailed && canRetry && !isShown && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <RetryFailedButton batchId={batch.id} failed={1} />
        </div>
      )}
      {isFailed && !canRetry && (
        <FinePrint>
          Only a curator in its custody or an administrator can retry{" "}
          {isShown ? (
            <>
              batch <b className="font-mono">{batch.id}</b>
            </>
          ) : (
            "it"
          )}
          .
        </FinePrint>
      )}
    </DetailCard>
  );
}

function DigitizationCard({
  iteration,
  title,
  nameOf,
  session,
}: {
  iteration: Iteration;
  // The document's, which the message names.
  title: string;
  nameOf: (userId: string) => string;
  session: Session;
}) {
  const { data: messageChannels = [] } = useMessageChannelsQuery();
  const [isMessaging, setIsMessaging] = useState(false);
  const { data: projects = [] } = useProjectsQuery();
  // A curator sees the list an item is on, its name and dates, without list.read.
  const { data: lists = [] } = useDigitizationListsQuery();
  const { data: pluginInstances = [] } = usePluginInstancesQuery();
  const project = projects.find((candidate) => candidate.id === iteration.projectId);
  const list = lists.find((candidate) => candidate.id === iteration.listId);
  const { data: categories = [] } = useCategoriesQuery();
  const canOpenProject =
    project !== undefined && can(session, "project.read", scopeOfProject(project));
  const canOpenList =
    list !== undefined &&
    (can(session, "list.read", scopeOfIteration(categories, iteration.categoryId)) ||
      (project !== undefined && can(session, "list.read", scopeOfProject(project))));
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
        ) : canOpenProject ? (
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
            {canOpenList ? (
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
        iteration.links.length === 0 ? (
          <Muted>not set yet — setting it makes it Published</Muted>
        ) : (
          <div className="grid gap-3">
            {[...iteration.links]
              .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary))
              .map((link) => (
                <div key={link.id} className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all underline underline-offset-4"
                    >
                      {link.url.replace(/^https?:\/\//, "")}
                    </a>
                    {iteration.links.length > 1 && link.isPrimary && (
                      <ToneBadge tone="purple">primary</ToneBadge>
                    )}
                  </div>
                  <Muted>
                    {link.instanceId === null
                      ? "web address"
                      : (pluginInstances.find((instance) => instance.id === link.instanceId)
                          ?.name ?? "plugin")}
                    {" · "}
                    {nameOf(link.setBy)}
                    {" · "}
                    {formatDay(link.setAt)}
                  </Muted>
                  {hasPermission(session, "iteration.publish") && (
                    <PublicationLinkActions iteration={iteration} link={link} title={title} />
                  )}
                </div>
              ))}
          </div>
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

  // A listed item reaches whoever made its list, for anyone else, while a Message instance is
  // enabled (MSG-recipients, MSG-order).
  const canMessageAuthor =
    list !== undefined && messageChannels.length > 0 && list.createdBy !== session.user.id;
  return (
    <DetailCard
      title="Digitization"
      action={
        canMessageAuthor ? (
          <Button size="sm" variant="outline" onClick={() => setIsMessaging(true)}>
            Message list author…
          </Button>
        ) : undefined
      }
    >
      <FactGrid facts={facts} />
      {canMessageAuthor && (
        <MessageDialog
          isOpen={isMessaging}
          onClose={() => setIsMessaging(false)}
          subject={{ kind: "listedItem", id: iteration.id }}
          label={title}
          recipientLabel="who made the list"
        />
      )}
    </DetailCard>
  );
}

function PublicationLinkActions({
  iteration,
  link,
  title,
}: {
  iteration: Iteration;
  link: Iteration["links"][number];
  title: string;
}) {
  const [isReplacing, setIsReplacing] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [primaryRefusal, setPrimaryRefusal] = useState<string | null>(null);
  const primary = useActionMutation({
    call: () => makeLinkPrimary(iteration.id, link.id),
    invalidates: iterationInvalidations,
    act: "ACT-link-primary",
    refusalTexts: { 404: "That link is gone.", 409: "It is already the primary link." },
  });
  const replacement = useActionMutation({
    call: (publication: Publication) => replaceLink(iteration.id, link.id, publication),
    invalidates: iterationInvalidations,
    act: "ACT-link-replace",
    refusalTexts: {
      404: "That link is gone.",
      "iteration.link_unread": "That is no web address, and no Link plugin reads it as a PID.",
      422: "That link is already there.",
    },
  });
  const removal = useActionMutation({
    call: () => removeLink(iteration.id, link.id),
    invalidates: iterationInvalidations,
    act: "ACT-link-remove",
    refusalTexts: { 404: "That link is gone.", 409: "The last link stays; replace it instead." },
  });
  const oldest = iteration.links
    .filter((candidate) => candidate.id !== link.id)
    .toSorted((a, b) => Date.parse(a.setAt) - Date.parse(b.setAt))[0];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {!link.isPrimary && (
        <Button
          size="sm"
          variant="outline"
          disabled={primary.isPending}
          onClick={async () => {
            const result = await primary.run(undefined);
            setPrimaryRefusal(result.isDone ? null : result.refusal.message);
          }}
        >
          Make primary
        </Button>
      )}
      {primaryRefusal !== null && (
        <p role="alert" className="text-xs text-destructive">
          {primaryRefusal}
        </p>
      )}
      <Button size="sm" variant="outline" onClick={() => setIsReplacing(true)}>
        Replace link…
      </Button>
      {iteration.links.length > 1 && (
        <Button size="sm" variant="outline" onClick={() => setIsRemoving(true)}>
          Remove link…
        </Button>
      )}
      <FormDialog
        isOpen={isReplacing}
        onClose={() => setIsReplacing(false)}
        title={`Replace link — ${title}`}
        description="Enter the new address for this link."
        schema={z.object({ link: z.string().trim().min(1, "Enter where the scan opens") })}
        defaultValues={{ link: link.url }}
        submitLabel="Replace link"
        onSubmit={(values) => replacement.run(values)}
        render={(form) => (
          <>
            <Field id={`replace-link-${link.id}`} label="Link">
              <Input id={`replace-link-${link.id}`} {...form.register("link")} />
            </Field>
            <FieldError message={form.formState.errors.link?.message} />
          </>
        )}
      />
      <ConsequenceDialog
        isOpen={isRemoving}
        onClose={() => setIsRemoving(false)}
        title="Remove link?"
        description="This link will no longer be available from the record."
        consequences={[
          { text: "The link is removed." },
          ...(link.isPrimary && oldest
            ? [{ text: `${oldest.url.replace(/^https?:\/\//, "")} becomes primary.` }]
            : []),
        ]}
        confirmLabel="Remove link"
        isDestructive
        onConfirm={() => removal.run(undefined)}
      />
    </div>
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
  const latest = latestPublicAskOf(record, userId);
  const status = publicRecordStatusOf(record, userId);
  const note = publicRecordNoteOf(record, userId);
  const readingLink = readingLinkOf(record);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-4">
        <RecordHeading
          title={document.title}
          identifier={documentIdentifierOf(document)}
          details={[latest === undefined ? null : `asked ${formatDay(latest.at)}`]}
        />
        <DocumentActions record={record} session={session} isOwn className="mb-4" />
      </div>
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
        <PropertiesCard record={record} audience="public" nameOf={() => ""} />
        <HistoryCard log={log} nameOf={() => ""} isPublic />
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

  const published = record.iterations.findLast((iteration) => primaryLinkOf(iteration) !== null);
  const primary = published === undefined ? null : primaryLinkOf(published);
  return primary === null ? null : { source: "VERA", url: primary.url };
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
