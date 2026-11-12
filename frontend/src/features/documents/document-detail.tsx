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
// custody or project.

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
import { useTranslation } from "react-i18next";
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
import { i18n } from "@/i18n";
import { formatCalendarDay, formatLongDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { joinDetails } from "@/lib/join-details";
import type { StatusNote as StatusNoteParts } from "@/lib/status-notes";
import { deskOf, publicRecordNoteOf, staffRecordNoteOf } from "@/lib/status-notes";

const categorySeparator = " / ";

interface DocumentDetailPaneProps {
  detail: DocumentDetail;
  session: Session;
}

export function DocumentDetailPane({ detail, session }: DocumentDetailPaneProps) {
  useTranslation("documents");
  return (
    <article className="@container max-w-5xl">
      <CatalogStateNote document={detail.record.document} />
      {detail.audience === "staff" ? (
        <StaffRecord detail={detail} session={session} />
      ) : (
        <OwnRecord detail={detail} session={session} />
      )}
    </article>
  );
}

function CatalogStateNote({ document }: { document: DocumentRecord["document"] }) {
  // DOC-relink: surface catalog changes before the document's other facts.
  const { t } = useTranslation("documents");
  const state = document.catalogState;
  if (state == null) return null;
  const title = t(state.kind === "gone" ? "detail.catalogGone" : "detail.catalogReplaced");
  const catalogId = state.kind === "gone" ? document.catalogId : state.catalogId;
  const catalogUrl = `https://vufind.mzk.cz/Record/${encodeURIComponent(catalogId)}`;
  return (
    <StatusNote tone="amber" title={title} className="mb-4">
      {state.kind === "gone" ? (
        <a
          href={catalogUrl}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          {catalogId}
        </a>
      ) : (
        <>
          <a
            href={catalogUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            {catalogId}
          </a>
          {state.documentId !== null && (
            <>
              {" "}
              ·{" "}
              <Link to={`/documents?id=${encodeURIComponent(state.documentId)}`}>
                {t("detail.openReplacement")}
              </Link>
            </>
          )}
        </>
      )}
    </StatusNote>
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
                  {i18n.t("documents:detail.decideInRequests")}
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
    label: i18n.t("field.status", { ns: "documents" }),
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
          { label: i18n.t("list.askers", { ns: "documents" }), value: askerCount },
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
        {
          label: i18n.t("field.category", { ns: "documents" }),
          value: categoryPath || current.categoryId,
          isText: true,
        },
        {
          label: i18n.t("field.priority", { ns: "documents" }),
          value: <PriorityBadge priority={current.priority} />,
          isText: true,
        },
        {
          label: i18n.t("detail.pageCount", { ns: "documents" }),
          value: pages === null ? "—" : formatCount(pages.value),
          foot:
            pages === null
              ? i18n.t("detail.noPageSource", { ns: "documents" })
              : i18n.t("detail.pageSource", {
                  ns: "documents",
                  source: pages.source,
                  tier: pages.tier,
                }),
        },
        where,
        { label: i18n.t("detail.iteration", { ns: "documents" }), value: current.attempt },
      ]}
    />
  );
}

// The view whose queue holds it, as a link only for whoever may open that view.
function whereNowOf(record: DocumentRecord, session: Session): Stat {
  const label = i18n.t("detail.whereNow", { ns: "documents" });
  const desk = deskOf(record);
  if (desk === null) {
    return { label, value: i18n.t("detail.nobody", { ns: "documents" }), isText: true };
  }

  if (desk === "documents") {
    const isFailed = currentIterationOf(record)?.progress === "IngestFailed";
    return {
      label,
      value: i18n.t("detail.here", { ns: "documents" }),
      foot: i18n.t(isFailed ? "detail.ingestFailed" : "detail.beingAdded", { ns: "documents" }),
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
      title={i18n.t("detail.defects", { ns: "documents", count: outstanding.length })}
      action={
        hasPermission(session, "validation.approve") && (
          <Button asChild size="sm" variant="outline">
            <Link to={`/review/documents?id=${encodeURIComponent(iteration.id)}`}>
              {i18n.t("documents:detail.resolveInValidations")}
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
          <b>{i18n.t("detail.deniedInReview", { ns: "documents" })}</b>
          {denial === undefined
            ? ""
            : i18n.t("detail.denialNote", { ns: "documents", note: denial.note })}
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
    <ToneBadge tone="red">{i18n.t("detail.failed", { ns: "documents" })}</ToneBadge>
  ) : iteration.progress === "Enqueued" ? (
    <ToneBadge tone="slate">{i18n.t("detail.waiting", { ns: "documents" })}</ToneBadge>
  ) : (
    <ToneBadge tone="green">{i18n.t("detail.ingested", { ns: "documents" })}</ToneBadge>
  );

  return (
    <DetailCard title={i18n.t("detail.adding", { ns: "documents" })}>
      <FactGrid
        facts={[
          ...(isShown
            ? [
                {
                  label: i18n.t("detail.batch", { ns: "documents" }),
                  value: (
                    <>
                      <span className="font-mono">{batch.id}</span> <Muted>{batch.name}</Muted>
                    </>
                  ),
                },
              ]
            : []),
          {
            label: i18n.t("detail.submitted", { ns: "documents" }),
            value: joinDetails([formatLongDay(batch.submittedAt), nameOf(batch.submittedBy)]),
          },
          { label: i18n.t("detail.ingest", { ns: "documents" }), value: ingest },
          {
            label: i18n.t("detail.attempts", { ns: "documents" }),
            value: iteration.ingestFailure?.attempts ?? 1,
          },
        ]}
      />
      {isFailed && (
        <StatusNote
          tone="red"
          className="mt-3"
          title={i18n.t("detail.couldNotBeAdded", { ns: "documents" })}
        >
          {iteration.ingestFailure?.error ?? i18n.t("detail.errorNotRecorded", { ns: "documents" })}
        </StatusNote>
      )}
      {isFailed && canRetry && !isShown && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <RetryFailedButton batchId={batch.id} failed={1} />
        </div>
      )}
      {isFailed && !canRetry && (
        <FinePrint>
          {isShown
            ? i18n.t("detail.retryPermissionBatch", { ns: "documents", id: batch.id })
            : i18n.t("detail.retryPermissionIt", { ns: "documents" })}
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
      label: i18n.t("field.progress", { ns: "documents" }),
      value: (
        <>
          {i18n.t(`progress.${iteration.progress}`, { ns: "documents" })}
          {cancellation !== null && (
            <Muted> · {i18n.t("detail.heldHere", { ns: "documents" })}</Muted>
          )}
        </>
      ),
    },
    {
      label: i18n.t("field.project", { ns: "documents" }),
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
      label: i18n.t("detail.list", { ns: "documents" }),
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
              · {formatCalendarDay(list.startsOn)} → {formatCalendarDay(list.endsOn)}
            </Muted>
          </>
        ) : (
          (iteration.formerListName ?? i18n.t("detail.notOnAList", { ns: "documents" }))
        ),
    },
  ];

  if (isProgressAtLeast(iteration.progress, "Digitized")) {
    facts.push({
      label: i18n.t("detail.availableAt", { ns: "documents" }),
      value:
        iteration.links.length === 0 ? (
          <Muted>{i18n.t("detail.notSetPublishing", { ns: "documents" })}</Muted>
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
                      <ToneBadge tone="purple">
                        {i18n.t("detail.primary", { ns: "documents" })}
                      </ToneBadge>
                    )}
                  </div>
                  <Muted>
                    {link.instanceId === null
                      ? i18n.t("detail.webAddress", { ns: "documents" })
                      : (pluginInstances.find((instance) => instance.id === link.instanceId)
                          ?.name ?? i18n.t("detail.plugin", { ns: "documents" }))}
                    {" · "}
                    {nameOf(link.setBy)}
                    {" · "}
                    {formatLongDay(link.setAt)}
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
    label: i18n.t("detail.cancelled", { ns: "documents" }),
    value:
      cancellation === null ? (
        <Muted>{i18n.t("detail.no", { ns: "documents" })}</Muted>
      ) : (
        joinDetails([
          cancellation.cause === "Decided"
            ? i18n.t("detail.yes", { ns: "documents" })
            : i18n.t("detail.couldNotDigitize", { ns: "documents" }),
          `${nameOf(cancellation.actorId)}, ${formatLongDay(cancellation.at)}`,
        ])
      ),
  });

  // A listed item reaches whoever made its list, for anyone else, while a Message instance is
  // enabled (MSG-recipients, MSG-order).
  const canMessageAuthor =
    list !== undefined && messageChannels.length > 0 && list.createdBy !== session.user.id;
  return (
    <DetailCard
      title={i18n.t("detail.digitization", { ns: "documents" })}
      action={
        canMessageAuthor ? (
          <Button size="sm" variant="outline" onClick={() => setIsMessaging(true)}>
            {i18n.t("detail.messageListAuthor", { ns: "documents" })}
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
          recipientLabel={i18n.t("detail.listAuthor", { ns: "documents" })}
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
    refusalTexts: {
      404: i18n.t("detail.linkGone", { ns: "documents" }),
      409: i18n.t("detail.alreadyPrimary", { ns: "documents" }),
    },
  });
  const replacement = useActionMutation({
    call: (publication: Publication) => replaceLink(iteration.id, link.id, publication),
    invalidates: iterationInvalidations,
    act: "ACT-link-replace",
    refusalTexts: {
      404: i18n.t("detail.linkGone", { ns: "documents" }),
      "iteration.link_unread": i18n.t("actions.linkUnread", { ns: "documents" }),
      422: i18n.t("actions.linkExists", { ns: "documents" }),
    },
  });
  const removal = useActionMutation({
    call: () => removeLink(iteration.id, link.id),
    invalidates: iterationInvalidations,
    act: "ACT-link-remove",
    refusalTexts: {
      404: i18n.t("detail.linkGone", { ns: "documents" }),
      409: i18n.t("detail.lastLink", { ns: "documents" }),
    },
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
          {i18n.t("detail.makePrimary", { ns: "documents" })}
        </Button>
      )}
      {primaryRefusal !== null && (
        <p role="alert" className="text-xs text-destructive">
          {primaryRefusal}
        </p>
      )}
      <Button size="sm" variant="outline" onClick={() => setIsReplacing(true)}>
        {i18n.t("detail.replaceLinkAction", { ns: "documents" })}
      </Button>
      {iteration.links.length > 1 && (
        <Button size="sm" variant="outline" onClick={() => setIsRemoving(true)}>
          {i18n.t("detail.removeLinkAction", { ns: "documents" })}
        </Button>
      )}
      <FormDialog
        isOpen={isReplacing}
        onClose={() => setIsReplacing(false)}
        title={i18n.t("detail.replaceLinkTitle", { ns: "documents", title })}
        description={i18n.t("detail.enterNewAddress", { ns: "documents" })}
        schema={z.object({
          link: z
            .string()
            .trim()
            .min(1, { error: () => i18n.t("actions.enterScanAddress", { ns: "documents" }) }),
        })}
        defaultValues={{ link: link.url }}
        submitLabel={i18n.t("detail.replaceLink", { ns: "documents" })}
        onSubmit={(values) => replacement.run(values)}
        render={(form) => (
          <>
            <Field
              id={`replace-link-${link.id}`}
              label={i18n.t("detail.link", { ns: "documents" })}
            >
              <Input id={`replace-link-${link.id}`} {...form.register("link")} />
            </Field>
            <FieldError message={form.formState.errors.link?.message} />
          </>
        )}
      />
      <ConsequenceDialog
        isOpen={isRemoving}
        onClose={() => setIsRemoving(false)}
        title={i18n.t("detail.removeLink", { ns: "documents" })}
        description={i18n.t("detail.removeLinkDescription", { ns: "documents" })}
        consequences={[
          { text: i18n.t("detail.linkRemoved", { ns: "documents" }) },
          ...(link.isPrimary && oldest
            ? [
                {
                  text: i18n.t("detail.becomesPrimary", {
                    ns: "documents",
                    url: oldest.url.replace(/^https?:\/\//, ""),
                  }),
                },
              ]
            : []),
        ]}
        confirmLabel={i18n.t("detail.removeLinkConfirm", { ns: "documents" })}
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
    <DetailCard
      title={i18n.t("detail.earlierIterations", { ns: "documents", count: earlier.length })}
    >
      {earlier.map((iteration) => (
        <DetailRow key={iteration.id} aside={<StatusBadge status={iterationStatusOf(iteration)} />}>
          <b className="font-semibold">
            {i18n.t("detail.iterationNumber", { ns: "documents", count: iteration.attempt })}
          </b>{" "}
          <Muted>
            {joinDetails([
              iteration.formerListName,
              iteration.scanDpi === null ? null : `${iteration.scanDpi} dpi`,
              i18n.t("detail.digitizedAt", {
                ns: "documents",
                day: iteration.digitizedAt === null ? "—" : formatLongDay(iteration.digitizedAt),
              }),
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
          details={[
            latest === undefined
              ? null
              : i18n.t("detail.askedAt", { ns: "documents", day: formatLongDay(latest.at) }),
          ]}
        />
        <DocumentActions record={record} session={session} isOwn className="mb-4" />
      </div>
      {note !== null && <RecordNote note={note} nameOf={() => ""} />}
      <StatTiles
        stats={[
          {
            label: i18n.t("field.status", { ns: "documents" }),
            value: status === null ? "—" : <StatusBadge status={status} />,
            isText: true,
          },
          {
            label: i18n.t("field.asked", { ns: "documents" }),
            value: latest === undefined ? "—" : formatLongDay(latest.at),
            isText: true,
          },
          {
            label: i18n.t("detail.readIt", { ns: "documents" }),
            value:
              readingLink === null ? (
                i18n.t("detail.notYet", { ns: "documents" })
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
          <DetailCard title={i18n.t("detail.whyIAsked", { ns: "documents" })}>
            <p>{latest.reason}</p>
            <FinePrint>{i18n.t("detail.askReasonPrivacy", { ns: "documents" })}</FinePrint>
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
      : i18n.t("detail.noteActedBy", {
          ns: "documents",
          title: note.title,
          name: nameOf(note.actedBy.actorId),
          day: formatLongDay(note.actedBy.at),
        });
  return (
    <StatusNote tone={note.tone} title={title} className="mb-4">
      {note.text}
    </StatusNote>
  );
}
