// A project's own page, `/projects/:projectId` (docs/demos/shared/page-projects.js detail;
// projects.md §1.1, §4): where it stands in words, the bars against its target, what was proposed
// into it, the lists carrying what it funded, the iterations it funded; beside them what it is,
// its members and its history. The target, planned, delivered and pace are its own intention's,
// linked on Intentions once approved; other intentions counting the same funding are measures
// beside it and are not shown here (intentions.md §3.4).
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { FundedItem, ProjectDetail, ProjectProposal } from "@/api/projects";
import { categoryLabelOf } from "@/components/classification-fields";
import { DataTable } from "@/components/data-table";
import { DetailCard, DetailRow, FinePrint, Muted } from "@/components/detail-card";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import { RecordPage } from "@/components/layout/record-page";
import type { ColumnDefinition } from "@/components/lists/record-list";
import type { Member } from "@/components/members-card";
import { MembersCard } from "@/components/members-card";
import { HistoryCard } from "@/components/record-cards";
import {
  ListStateBadge,
  PriorityBadge,
  StatusWithFootnote,
  ToneBadge,
} from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { PaceBars } from "@/components/visualizations/pace-bars";
import { documentIdentifierOf } from "@/domain/documents";
import type { Category, Session } from "@/domain/entities";
import { progressValues } from "@/domain/entities";
import { can } from "@/domain/permissions";
import { iterationStatusOf, statusFootnoteOf } from "@/domain/status";
import { useProjectActions } from "@/features/projects/project-actions";
import { ProjectBadges } from "@/features/projects/project-card";
import {
  pagesOf,
  periodTextOf,
  projectNoteOf,
  targetTextOf,
  timeLabelOf,
} from "@/features/projects/projects-view";
import { useProjectQuery } from "@/features/projects/use-projects-query";
import { useCategoriesQuery, useUsersQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { formatDay, formatShortCalendarDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";

const backToIndex = { label: "Projects", href: "/projects" };
const backToProjects = { label: "Back to Projects", href: "/projects" };

export function ProjectPage() {
  const { projectId = null } = useParams();
  const { data: detail } = useProjectQuery(projectId);
  const { data: users = [] } = useUsersQuery();
  const { data: categories = [] } = useCategoriesQuery();
  const { data: session } = useSessionQuery();

  if (detail === undefined || session === undefined) {
    return <PageHeader title="Project" breadcrumb={backToIndex} back={backToProjects} />;
  }

  if (detail === null) {
    return (
      <>
        <PageHeader title="Project" breadcrumb={backToIndex} back={backToProjects} />
        <PageContent>
          <StatusNote tone="slate" title="You are not on that project">
            It is gone, or only its members and whoever decides projects see it.
          </StatusNote>
        </PageContent>
      </>
    );
  }

  const nameOf = (userId: string) => users.find((user) => user.id === userId)?.name ?? userId;
  return (
    <ProjectRecord
      key={detail.row.project.id}
      detail={detail}
      session={session}
      nameOf={nameOf}
      categories={categories}
    />
  );
}

interface ProjectRecordProps {
  detail: ProjectDetail;
  nameOf: (userId: string) => string;
  categories: readonly Category[];
}

function ProjectRecord({
  detail,
  session,
  nameOf,
  categories,
}: ProjectRecordProps & { session: Session }) {
  const navigate = useNavigate();
  const { row } = detail;
  const { project } = row;
  const { pageActions, editMembers, dialogs } = useProjectActions({
    row,
    session,
    onDeleted: () => navigate("/projects"),
  });
  const note = projectNoteOf(row, project.state === "Proposed" ? "" : nameOf(project.actorId));
  const standing = [project.state, project.state === "Rejected" ? null : row.period]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <RecordPage
      header={{
        title: project.name,
        actions: pageActions,
        breadcrumb: { ...backToIndex, detail: `${standing} · ${periodTextOf(project)}` },
        back: backToProjects,
      }}
      note={
        <StatusNote tone={note.tone} title={note.title}>
          {note.body}
        </StatusNote>
      }
      aside={
        <>
          <AboutCard detail={detail} nameOf={nameOf} />
          <ProjectMembersCard detail={detail} nameOf={nameOf} onEdit={editMembers} />
          {dialogs}
        </>
      }
      history={<HistoryCard log={detail.log} nameOf={nameOf} isPublic={false} />}
    >
      {project.state !== "Rejected" && (
        <DetailCard
          title="Against the target"
          action={
            project.state === "Approved" && can(session, "intention.read") ? (
              <Button asChild size="sm" variant="outline">
                <Link to={`/intentions?i=${encodeURIComponent(row.intention.id)}`}>
                  Its intention
                </Link>
              </Button>
            ) : (
              <Muted>{targetTextOf(row)}</Muted>
            )
          }
        >
          <PaceBars
            target={row.intention.targetPages ?? 0}
            timeElapsed={row.timeElapsed}
            timeLabel={timeLabelOf(row)}
            pages={pagesOf(row)}
            evenPace={row.evenPace}
            density="detail"
          />
          {row.intention.targetPages === null ? (
            <p className="mt-2 text-[0.8125rem]">
              No target: its intention only counts output.{" "}
              <Muted>
                {formatCount(row.plannedPages)} pp planned · {formatCount(row.deliveredPages)}{" "}
                delivered
              </Muted>
            </p>
          ) : null}
          <FinePrint>
            {project.state === "Approved"
              ? `These are its intention's figures, counted over the project's period: the target is set here, on the project, and the mix on the intention. The mark on the planned and delivered bars is where they would be at an even pace${
                  row.evenPace === null ? "" : "; within 10 points of it reads on pace"
                }. Delivered is a part of planned: the two are never added.`
              : "Nothing counts towards it until it is approved: what is proposed into it is still waiting."}
          </FinePrint>
        </DetailCard>
      )}
      <ProposalsCard detail={detail} nameOf={nameOf} />
      <ListsCard detail={detail} />
      <FundedCard detail={detail} categories={categories} />
    </RecordPage>
  );
}

function AboutCard({ detail, nameOf }: Omit<ProjectRecordProps, "categories">) {
  const { project } = detail.row;
  return (
    <DetailCard
      title="About"
      action={
        <span className="flex flex-wrap justify-end gap-1.5">
          <ProjectBadges row={detail.row} />
        </span>
      }
    >
      {project.description === "" ? (
        <Muted>No description.</Muted>
      ) : (
        <p className="mb-2">{project.description}</p>
      )}
      <DetailRow aside={nameOf(project.managerId)}>
        <Muted>Manager</Muted>
      </DetailRow>
      <DetailRow
        aside={
          project.state === "Proposed"
            ? "not yet"
            : `${project.state} ${formatDay(project.at)} · ${nameOf(project.actorId)}`
        }
      >
        <Muted>Decision</Muted>
      </DetailRow>
      {project.state === "Approved" && (
        <>
          <DetailRow aside={<PriorityBadge priority={project.priority} />}>
            <Muted>Priority</Muted>
          </DetailRow>
          <FinePrint>
            Set once, at approval: the proposals approved with it took it, and it pre-fills those
            proposed after. Each item's priority is its own from then on.
          </FinePrint>
        </>
      )}
    </DetailCard>
  );
}

function ProjectMembersCard({
  detail,
  nameOf,
  onEdit,
}: Omit<ProjectRecordProps, "categories"> & { onEdit: (() => void) | null }) {
  const { project, memberGroups } = detail.row;
  const members: Member[] = [
    // The manager first.
    ...project.memberIds
      .toSorted(
        (first, second) =>
          Number(second === project.managerId) - Number(first === project.managerId),
      )
      .map((userId) => ({
        kind: "user" as const,
        id: userId,
        label: nameOf(userId),
        role: userId === project.managerId ? "manager" : "member",
      })),
    ...memberGroups.map((group) => ({
      kind: "group" as const,
      id: group.id,
      label: group.name,
      role: plural(group.peopleCount, "person", "people"),
    })),
  ];

  return (
    <MembersCard
      title="Members"
      members={members}
      emptyText="Nobody yet."
      action={
        onEdit === null ? undefined : (
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
        )
      }
    >
      <FinePrint>
        Members propose documents into it
        {project.state === "Rejected" ? ", not any more" : ""}. A grant scoped to project means
        exactly these people and groups; one scoped to managed, its manager.
      </FinePrint>
    </MembersCard>
  );
}

const decisionLabels = {
  Pending: "Pending",
  Approved: "Approved",
  Denied: "Declined",
  Withdrawn: "Withdrawn",
  Duplicate: "Duplicate",
} as const satisfies Record<ProjectProposal["decision"], string>;

const decisionTones = {
  Pending: "amber",
  Approved: "green",
  Denied: "red",
  Withdrawn: "slate",
  Duplicate: "slate",
} as const satisfies Record<ProjectProposal["decision"], "amber" | "green" | "red" | "slate">;

function ProposalsCard({ detail, nameOf }: Omit<ProjectRecordProps, "categories">) {
  const { project } = detail.row;
  const { proposals } = detail;
  return (
    <DetailCard title={`Proposals — ${proposals.length}`}>
      {proposals.length === 0 && (
        <Muted>
          {project.state === "Rejected"
            ? "None."
            : "None yet. Members propose documents into it from Documents."}
        </Muted>
      )}
      {proposals.map((proposal) => {
        const flags = [
          proposal.isAfterProjectApproval ? "after the project's approval" : null,
          proposal.hasCopy ? "a copy exists" : null,
        ].filter((flag) => flag !== null);
        return (
          <DetailRow
            key={proposal.documentId}
            aside={
              <ToneBadge tone={decisionTones[proposal.decision]}>
                {decisionLabels[proposal.decision]}
              </ToneBadge>
            }
          >
            <Link
              to={`/requests?id=${encodeURIComponent(proposal.documentId)}`}
              className="font-medium hover:underline"
            >
              {proposal.title}
            </Link>{" "}
            <Muted>{proposal.identifier}</Muted>
            <div className="text-xs text-muted-foreground">
              {[`${nameOf(proposal.requesterId)} · ${formatDay(proposal.at)}`, ...flags].join(
                " · ",
              )}
            </div>
          </DetailRow>
        );
      })}
      {proposals.length > 0 && (
        <FinePrint>
          {project.state === "Approved"
            ? "What is proposed after the approval is decided on its own in Requests, with this project's priority pre-filled."
            : project.state === "Proposed"
              ? "Ordinary pending proposals: a curator may decide one before the project is decided."
              : "Rejected with the project, except where somebody else asked too."}
        </FinePrint>
      )}
    </DetailCard>
  );
}

function ListsCard({ detail }: { detail: ProjectDetail }) {
  const { lists, formerLists, row } = detail;
  if (row.fundedCount === 0) {
    return null;
  }

  return (
    <DetailCard title={`Lists — ${lists.length + formerLists.length}`}>
      {lists.length + formerLists.length === 0 && (
        <Muted>None of what it funds is on a list yet.</Muted>
      )}
      {lists.map(({ list, state, itemCount, pages }) => (
        <DetailRow
          key={list.id}
          aside={
            <span className="grid justify-items-end gap-0.5 text-xs">
              <ListStateBadge state={state} />
              <Muted>
                {itemCount} of its items · {formatCount(pages)} pp
              </Muted>
            </span>
          }
        >
          <Link
            to={`/lists?id=${encodeURIComponent(list.id)}`}
            className="font-medium hover:underline"
          >
            {list.name}
          </Link>
          <div className="text-xs text-muted-foreground">
            {list.id} · {formatShortCalendarDay(list.startsOn)} →{" "}
            {formatShortCalendarDay(list.endsOn)}
          </div>
        </DetailRow>
      ))}
      {formerLists.map(({ name, itemCount }) => (
        <DetailRow
          key={name}
          aside={
            <span className="text-xs text-muted-foreground">
              {itemCount} of its items · not counted
            </span>
          }
        >
          {name} <Muted>· no longer exists</Muted>
        </DetailRow>
      ))}
      {lists.length + formerLists.length > 0 && (
        <FinePrint>
          The lists carrying items it funded. A list can mix funding: only this project's pages are
          counted here. A deleted list's items stop counting.
        </FinePrint>
      )}
    </DetailCard>
  );
}

// Furthest along first.
const progressRank = (item: FundedItem) => progressValues.indexOf(item.iteration.progress);

function FundedCard({
  detail,
  categories,
}: {
  detail: ProjectDetail;
  categories: readonly Category[];
}) {
  const { row, funded } = detail;
  if (funded.length === 0 && row.project.state !== "Approved") {
    return null;
  }

  const document: ColumnDefinition<FundedItem> = {
    key: "document",
    header: "Document",
    track: "minmax(12rem,1fr)",
    cell: (item) => (
      <>
        <Link
          to={`/documents?id=${encodeURIComponent(item.document.id)}`}
          className="font-medium hover:underline"
        >
          {item.document.title}
        </Link>{" "}
        <Muted>{documentIdentifierOf(item.document)}</Muted>
      </>
    ),
  };
  const column = (
    key: string,
    header: string,
    cell: (item: FundedItem) => ReactNode,
  ): ColumnDefinition<FundedItem> => ({ key, header, track: "max-content", cell });
  const category = column("category", "Category", (item) => (
    <Muted>{categoryLabelOf(categories, item.iteration.categoryId)}</Muted>
  ));
  const list = column("list", "List", (item) => <Muted>{item.listName ?? "—"}</Muted>);
  const pages: ColumnDefinition<FundedItem> = {
    ...column("pages", "Pages", (item) => (item.pages === null ? "—" : formatCount(item.pages))),
    isNumeric: true,
  };
  const status = column("status", "Status", (item) => (
    <StatusWithFootnote
      status={iterationStatusOf(item.iteration)}
      footnote={statusFootnoteOf(item.iteration)}
    />
  ));

  return (
    <DetailCard title={`What it funded — ${funded.length}`}>
      {funded.length === 0 ? (
        <Muted>Nothing yet: no approved request names this project.</Muted>
      ) : (
        <>
          <DataTable
            rows={funded.toSorted((first, second) => progressRank(second) - progressRank(first))}
            rowId={(item) => item.iteration.id}
            columns={{
              notebook: [document, category, list, pages, status],
              small: [document, pages, status],
              phone: [document, status],
            }}
            emptyText=""
          />
          <FinePrint>
            Iterations, not documents: a rescan of the same book can be funded by another grant.{" "}
            <Link
              to={`/documents?project=${encodeURIComponent(row.project.id)}`}
              className="text-foreground underline"
            >
              Open in Documents
            </Link>
            .
          </FinePrint>
        </>
      )}
    </DetailCard>
  );
}
