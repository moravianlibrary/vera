// One document's proposal beside the list (page-proposals.js render): a note on what stands out,
// the facts, then a card for each part: who asked, where it was placed, the existing copies, the
// catalog record and the history. The decision, with its category and priority, sits at the top
// of the cards.
// TODO(rrandiak): Message askers (messaging.md §3); labels move to i18n.

import { ArrowRight } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { ApiError } from "@/api/http";
import type { ProposalDetail } from "@/api/proposal-review";
import {
  CategorySelect,
  categoryLabelOf,
  Field,
  PrioritySelect,
} from "@/components/classification-fields";
import { DetailCard, DetailRow, Muted, StatTiles } from "@/components/detail-card";
import { visibleNavigation } from "@/components/layout/navigation";
import {
  AskersCard,
  CatalogCard,
  CopiesCard,
  HistoryCard,
  RecordHeading,
} from "@/components/record-cards";
import { ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { documentIdentifierOf, existingCopiesOf } from "@/domain/documents";
import type { Priority, Project, ProposalCustody, Session } from "@/domain/entities";
import type { ProposalRow } from "@/domain/proposal-review";
import {
  askerIdsOf,
  asksOf,
  batchIdsOf,
  firstAskOf,
  isAfterProjectApproval,
  isBeingChecked,
  isHeld,
  isRescan,
  projectIdsOf,
} from "@/domain/proposal-review";
import { ProposalStatusBadge } from "@/features/proposals/proposal-status";
import {
  useDecisionMutations,
  useProposalCustodiesQuery,
} from "@/features/proposals/use-proposals-query";
import { useCategoriesQuery, useProjectsQuery, useUsersQuery } from "@/hooks/use-reference-query";
import { formatDay } from "@/lib/format-date";
import { joinDetails } from "@/lib/join-details";

// What the pane says once a decision has taken the proposal off the list.
export interface DecisionOutcome {
  documentId: string;
  title: string;
  summary: string;
}

interface ProposalDetailPaneProps {
  detail: ProposalDetail;
  session: Session;
  onDecided: (outcome: DecisionOutcome) => void;
}

export function ProposalDetailPane({ detail, session, onDecided }: ProposalDetailPaneProps) {
  const { row, log } = detail;
  const { record } = row;
  const { document } = record;
  const { data: users = [] } = useUsersQuery();
  const { data: projects = [] } = useProjectsQuery();
  const { data: custodies = [] } = useProposalCustodiesQuery();
  const nameOf = (userId: string) => users.find((user) => user.id === userId)?.name ?? userId;
  const documents = visibleNavigation(session).find((entry) => entry.id === "documents");

  return (
    <article className="@container max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-x-4">
        <RecordHeading
          title={document.title}
          identifier={documentIdentifierOf(document)}
          details={[document.type, document.signature]}
        />
        {documents !== undefined && (
          <Button asChild size="sm" variant="outline" className="mb-4">
            <Link to={`${documents.path}?id=${encodeURIComponent(document.id)}`}>
              Open in {documents.visibleLabel}
              <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
      <ProposalNote row={row} nameOf={nameOf} />
      <ProposalFacts row={row} />

      <div className="mt-4 grid gap-4">
        {row.decision === "Pending" && (
          <DecideCard key={document.id} row={row} projects={projects} onDecided={onDecided} />
        )}
        <AskersCard record={record} users={users} />
        <PlacedCard row={row} projects={projects} custodies={custodies} />
        <CopiesCard record={record} nameOf={nameOf} />
        <CatalogCard document={document} nameOf={nameOf} />
        <HistoryCard record={record} log={log} nameOf={nameOf} isPublic={false} />
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- deciding

// The project's priority, when the proposal came into an approved project after its approval
// (projects.md §2.1); the decider may pick another.
function prefilledPriorityOf(
  row: ProposalRow,
  projects: readonly Project[],
): { project: Project; priority: Priority } | null {
  if (!isAfterProjectApproval(row)) {
    return null;
  }

  for (const projectId of projectIdsOf(row)) {
    const project = projects.find((candidate) => candidate.id === projectId);
    if (project?.state === "Approved") {
      return { project, priority: project.priority };
    }
  }

  return null;
}

interface DecideCardProps {
  row: ProposalRow;
  projects: readonly Project[];
  onDecided: (outcome: DecisionOutcome) => void;
}

// One decision for every asker (status-model.md §2.7). Approving needs a category, and over a
// copy a note on why it is scanned again; declining needs what every asker is told.
function DecideCard({ row, projects, onDecided }: DecideCardProps) {
  const fieldId = useId();
  const { data: categories = [] } = useCategoriesQuery();
  const { approve, decline } = useDecisionMutations();
  const prefilled = prefilledPriorityOf(row, projects);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>(prefilled?.priority ?? "Normal");
  const [rescanNote, setRescanNote] = useState("");
  const [isDeclining, setIsDeclining] = useState(false);
  const [publicText, setPublicText] = useState("");
  const [internalText, setInternalText] = useState("");

  const documentId = row.record.document.id;
  const title = row.record.document.title;
  const askCount = asksOf(row).length;
  const forAll = askCount > 1 ? ` for all ${askCount}` : "";
  const rescan = isRescan(row);
  const isSaving = approve.isPending || decline.isPending;
  const failure = approve.error ?? decline.error;

  if (isBeingChecked(row)) {
    return (
      <DetailCard title="Decide">
        <p className="text-muted-foreground">
          The checks have not answered yet. It can be decided once they have.
        </p>
      </DetailCard>
    );
  }

  const approvalRefusal =
    categoryId === null
      ? "Choose a category"
      : rescan && rescanNote.trim() === ""
        ? "Say why it is scanned again"
        : null;

  const submitApproval = () => {
    if (categoryId === null) {
      return;
    }

    const approval = { categoryId, priority, rescanNote: rescan ? rescanNote.trim() : null };
    const summary = joinDetails([
      rescan ? "Approved as rescan" : "Approved",
      categoryLabelOf(categories, categoryId),
      priority,
      askCount === 1 ? "the asker is told" : `all ${askCount} askers are told`,
    ]);
    // The promise settles even once the refetch has taken this card away; a failure shows below.
    approve
      .mutateAsync({ documentId, approval })
      .then(() => onDecided({ documentId, title, summary }))
      .catch(() => undefined);
  };

  const submitDecline = () =>
    decline.mutate({
      documentId,
      decline: { publicText: publicText.trim(), internalText: internalText.trim() || null },
    });

  return (
    <DetailCard title={`Decide${forAll}`}>
      <div className="grid gap-3">
        <div className="grid gap-3 @md:grid-cols-[minmax(0,1fr)_10rem]">
          <Field id={`${fieldId}-category`} label="Category">
            <CategorySelect
              id={`${fieldId}-category`}
              value={categoryId}
              onChange={setCategoryId}
            />
          </Field>
          <Field id={`${fieldId}-priority`} label="Priority">
            <PrioritySelect id={`${fieldId}-priority`} value={priority} onChange={setPriority} />
          </Field>
        </div>
        {prefilled !== null && (
          <p className="text-xs text-muted-foreground">
            Pre-filled from {prefilled.project.name}, approved at {prefilled.priority}.
          </p>
        )}
        {rescan && (
          <Field id={`${fieldId}-rescan`} label="Why scan it again" hint="kept in the history">
            <Textarea
              id={`${fieldId}-rescan`}
              rows={2}
              value={rescanNote}
              onChange={(event) => setRescanNote(event.target.value)}
              placeholder="e.g. the existing scan is 150 dpi greyscale"
            />
          </Field>
        )}

        {!isDeclining ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={isSaving || approvalRefusal !== null}
              onClick={submitApproval}
            >
              {rescan ? "Approve as rescan" : "Approve"}
              {forAll}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              disabled={isSaving}
              onClick={() => setIsDeclining(true)}
            >
              Decline{forAll}…
            </Button>
            {approvalRefusal !== null && (
              <span className="text-xs text-muted-foreground">{approvalRefusal}</span>
            )}
          </div>
        ) : (
          <div className="grid gap-3 rounded-lg border p-3">
            <Field
              id={`${fieldId}-public`}
              label="What they are told"
              hint={askCount === 1 ? "the asker reads this" : `all ${askCount} askers read this`}
            >
              <Textarea
                id={`${fieldId}-public`}
                rows={2}
                value={publicText}
                onChange={(event) => setPublicText(event.target.value)}
                placeholder="About the document, never a motive"
              />
            </Field>
            <Field id={`${fieldId}-internal`} label="Internal note" hint="optional; staff only">
              <Textarea
                id={`${fieldId}-internal`}
                rows={2}
                value={internalText}
                onChange={(event) => setInternalText(event.target.value)}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={isSaving || publicText.trim() === ""}
                onClick={submitDecline}
              >
                Decline{forAll}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsDeclining(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {failure !== null && (
          <p className="text-xs text-destructive">
            {failure instanceof ApiError && failure.status === conflictStatus
              ? "Someone has decided it meanwhile."
              : "The decision could not be saved. Try again."}
          </p>
        )}
      </div>
    </DetailCard>
  );
}

const conflictStatus = 409;

// ---------------------------------------------------------------- the record

// What stands out about the row: how it was decided, or a copy that makes approving a rescan.
function ProposalNote({ row, nameOf }: { row: ProposalRow; nameOf: (userId: string) => string }) {
  const first = firstAskOf(row);
  const [copy] = existingCopiesOf(asksOf(row));

  if (first?.decision === "Denied") {
    const { decline } = first;
    return (
      <StatusNote
        tone="red"
        className="mb-4"
        title={`Declined by ${nameOf(decline.actorId)}, ${formatDay(decline.at)}`}
      >
        {decline.internalText !== null && `${decline.internalText} `}
        They were told: “{decline.publicText}”
      </StatusNote>
    );
  }

  if (first?.decision === "Withdrawn") {
    return (
      <StatusNote
        tone="slate"
        className="mb-4"
        title={`Withdrawn by the asker, ${formatDay(first.withdrawnAt)}`}
      >
        {first.reason === null ? "No reason given." : `“${first.reason}”`}
      </StatusNote>
    );
  }

  if (copy === undefined) {
    return null;
  }

  if (isHeld(row)) {
    return (
      <StatusNote tone="amber" className="mb-4" title="Asked to be added">
        Approval was asked for on arrival, and {copy.source} already has it.
      </StatusNote>
    );
  }

  return (
    <StatusNote
      tone="purple"
      className="mb-4"
      title={`${copy.source}: ${copy.state.toLowerCase()}`}
    >
      Approving scans it again.
    </StatusNote>
  );
}

function ProposalFacts({ row }: { row: ProposalRow }) {
  const first = firstAskOf(row);
  const elsewhere = batchIdsOf(row).filter((batchId) => batchId !== first?.batchId);
  const batchLine = [
    first?.batchId === null || first === null ? "asked on its own" : `in ${first.batchId}`,
    ...elsewhere.map((batchId) => `also ${batchId}`),
  ].join(" · ");

  return (
    <StatTiles
      stats={[
        { label: "Status", value: <ProposalStatusBadge row={row} />, isText: true },
        { label: "Askers", value: askerIdsOf(row).length },
        {
          label: row.decision === "Pending" ? "Waiting since" : "First asked",
          value: first === null ? "—" : formatDay(first.at),
          foot: batchLine,
          isText: true,
        },
      ]}
    />
  );
}

// The proposal custodies the rules placed it in, and the project it was asked for.
function PlacedCard({
  row,
  projects,
  custodies,
}: {
  row: ProposalRow;
  projects: readonly Project[];
  custodies: readonly ProposalCustody[];
}) {
  const placed = row.custodyIds.map(
    (custodyId) =>
      custodies.find((custody) => custody.id === custodyId) ?? {
        id: custodyId,
        name: custodyId,
        description: "",
        isFallback: false,
      },
  );
  const asked = projectIdsOf(row).flatMap((projectId) => {
    const project = projects.find((candidate) => candidate.id === projectId);
    return project === undefined ? [] : [project];
  });

  return (
    <DetailCard title="Placed in">
      <div className="text-xs text-muted-foreground">Proposal custody</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {placed.map((custody) => (
          <ToneBadge key={custody.id} tone={custody.isFallback ? "amber" : "slate"}>
            {custody.isFallback ? `${custody.name} · no rule placed it` : custody.name}
          </ToneBadge>
        ))}
      </div>

      {asked.length > 0 && (
        <div className="mt-3.5">
          <div className="text-xs text-muted-foreground">Project</div>
          {asked.map((project) => (
            <DetailRow
              key={project.id}
              aside={
                project.state === "Proposed" && <Muted>approving the project approves it too</Muted>
              }
            >
              <b className="font-semibold">{project.name}</b>
              <div className="text-muted-foreground">
                {project.state}
                {project.state === "Approved" && ` at ${project.priority}`}
                {isAfterProjectApproval(row) && " · proposed after its approval"}
              </div>
            </DetailRow>
          ))}
        </div>
      )}
    </DetailCard>
  );
}
