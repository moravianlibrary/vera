// One document's proposal beside the list (page-proposals.js render): a note on what stands out,
// the facts, then a card for each part: who asked, where it was placed, the existing copies, the
// catalog record and the history. The decision, with its category and priority, sits at the top
// of the cards.
// TODO(rrandiak): Message askers (messaging.md §3); labels move to i18n.

import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import type { ProposalDetail } from "@/api/proposal-review";
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
import { documentIdentifierOf, existingCopiesOf } from "@/domain/documents";
import type { Project, ProposalCustody, Session } from "@/domain/entities";
import type { ProposalRow } from "@/domain/proposal-review";
import {
  askerIdsOf,
  asksOf,
  batchIdsOf,
  firstAskOf,
  isAfterProjectApproval,
  isHeld,
  projectIdsOf,
} from "@/domain/proposal-review";
import { ProposalStatusBadge } from "@/features/proposals/proposal-status";
import { useProposalCustodiesQuery } from "@/features/proposals/use-proposals-query";
import { useProjectsQuery, useUsersQuery } from "@/hooks/use-reference-query";
import { formatDay } from "@/lib/format-date";

interface ProposalDetailPaneProps {
  detail: ProposalDetail;
  session: Session;
}

export function ProposalDetailPane({ detail, session }: ProposalDetailPaneProps) {
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
        <AskersCard record={record} users={users} />
        <PlacedCard row={row} projects={projects} custodies={custodies} />
        <CopiesCard record={record} nameOf={nameOf} />
        <CatalogCard document={document} nameOf={nameOf} />
        <HistoryCard record={record} log={log} nameOf={nameOf} isPublic={false} />
      </div>
    </article>
  );
}

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
