// A project's own page, `/projects/:projectId` (docs/demos/shared/page-projects.js detail;
// projects.md §1.1, §4): where it stands in words, the bars against its target, what was proposed
// into it, the lists carrying what it funded, the iterations it funded; beside them what it is,
// its members and its history. The target, planned, delivered and pace are its own intention's,
// linked on Intentions once approved; other intentions counting the same funding are measures
// beside it and are not shown here (intentions.md §3.4).

import type { FundedItem, ProjectDetail, ProjectProposal } from "@vera/contract/projects";
import { documentIdentifierOf } from "@vera/domain/documents";
import type { Category, Session } from "@vera/domain/entities";
import { progressValues } from "@vera/domain/entities";
import { can } from "@vera/domain/permissions";
import { iterationStatusOf, statusFootnoteOf } from "@vera/domain/status";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { categoryLabelOf } from "@/components/classification-fields";
import { DataTable } from "@/components/data-table";
import { DetailCard, DetailRow, FinePrint, Muted } from "@/components/detail-card";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import { RecordPage } from "@/components/layout/record-page";
import type { ColumnDefinition } from "@/components/lists/record-list";
import type { Member } from "@/components/members-card";
import { MembersCard } from "@/components/members-card";
import { failureOf, QueryState } from "@/components/query-state";
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

const backToIndex = { label: "projects:projectPage.projects", href: "/projects" };
const backToProjects = { label: "projects:projectPage.backToProjects", href: "/projects" };

export function ProjectPage() {
  const { t } = useTranslation("projects");
  const { projectId = null } = useParams();
  const detailQuery = useProjectQuery(projectId);
  const { data: detail } = detailQuery;
  const { data: users = [] } = useUsersQuery();
  const { data: categories = [] } = useCategoriesQuery();
  const { data: session } = useSessionQuery();

  if (detailQuery.isError)
    return (
      <>
        <PageHeader
          title={t("projectPage.project")}
          breadcrumb={backToIndex}
          back={backToProjects}
        />
        <QueryState
          isLoading={false}
          failure={failureOf(detailQuery, t("projectPage.loadFailure"))}
        >
          <span />
        </QueryState>
      </>
    );

  if (detail === undefined || session === undefined) {
    return (
      <>
        <PageHeader
          title={t("projectPage.project")}
          breadcrumb={backToIndex}
          back={backToProjects}
        />
        <QueryState
          isLoading={detailQuery.isLoading}
          failure={failureOf(detailQuery, t("projectPage.loadFailure"))}
          loadingText={t("projectPage.loading")}
        >
          <span />
        </QueryState>
      </>
    );
  }

  if (detail === null) {
    return (
      <>
        <PageHeader
          title={t("projectPage.project")}
          breadcrumb={backToIndex}
          back={backToProjects}
        />
        <PageContent>
          <StatusNote tone="slate" title={t("projectPage.unavailableTitle")}>
            {t("projectPage.unavailableBody")}
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
  const { t } = useTranslation("projects");
  const navigate = useNavigate();
  const { row } = detail;
  const { project } = row;
  const { pageActions, editMembers, dialogs } = useProjectActions({
    row,
    session,
    onDeleted: () => navigate("/projects"),
  });
  const note = projectNoteOf(row, project.state === "Proposed" ? "" : nameOf(project.actorId));
  const standing = [
    t(`projectState.${project.state}`),
    project.state === "Rejected" ? null : t(`projectPeriod.${row.period}`),
  ]
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
          title={t("projectPage.againstTarget")}
          action={
            project.state === "Approved" && can(session, "intention.read") ? (
              <Button asChild size="sm" variant="outline">
                <Link to={`/intentions?i=${encodeURIComponent(row.intention.id)}`}>
                  {t("projectPage.itsIntention")}
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
            <p className="mt-2 text-ui">
              {t("projectPage.noTarget")}{" "}
              <Muted>
                {formatCount(row.plannedPages)} pp planned · {formatCount(row.deliveredPages)}{" "}
                delivered
              </Muted>
            </p>
          ) : null}
          <FinePrint>
            {project.state === "Approved"
              ? t("projectPage.approvedFinePrint", {
                  evenPace: row.evenPace !== null ? t("projectPage.withinPace") : "",
                })
              : t("projectPage.proposedFinePrint")}
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
  const { t } = useTranslation("projects");
  const { project } = detail.row;
  return (
    <DetailCard
      title={t("projectPage.about")}
      action={
        <span className="flex flex-wrap justify-end gap-1.5">
          <ProjectBadges row={detail.row} />
        </span>
      }
    >
      {project.description === "" ? (
        <Muted>{t("projectPage.noDescription")}</Muted>
      ) : (
        <p className="mb-2">{project.description}</p>
      )}
      <DetailRow aside={nameOf(project.managerId)}>
        <Muted>{t("projectPage.manager")}</Muted>
      </DetailRow>
      <DetailRow
        aside={
          project.state === "Proposed"
            ? t("projectPage.notYet")
            : t("projectPage.decisionMade", {
                state: t(`projectState.${project.state}`),
                date: formatDay(project.at),
                name: nameOf(project.actorId),
              })
        }
      >
        <Muted>{t("projectPage.decision")}</Muted>
      </DetailRow>
      {project.state === "Approved" && (
        <>
          <DetailRow aside={<PriorityBadge priority={project.priority} />}>
            <Muted>{t("projectPage.priority")}</Muted>
          </DetailRow>
          <FinePrint>{t("projectPage.priorityFinePrint")}</FinePrint>
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
  const { t } = useTranslation("projects");
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
      role: t("projectPage.person", { count: group.peopleCount }),
    })),
  ];

  return (
    <MembersCard
      title={t("projectPage.members")}
      members={members}
      emptyText={t("projectPage.nobodyYet")}
      action={
        onEdit === null ? undefined : (
          <Button variant="outline" size="sm" onClick={onEdit}>
            {t("projectPage.edit")}
          </Button>
        )
      }
    >
      <FinePrint>
        {t("projectPage.membersFinePrint", {
          rejected: project.state === "Rejected" ? t("projectPage.noLonger") : "",
        })}
      </FinePrint>
    </MembersCard>
  );
}

const decisionLabels = {
  Pending: "proposalDecision.Pending",
  Approved: "proposalDecision.Approved",
  Denied: "proposalDecision.Denied",
  Withdrawn: "proposalDecision.Withdrawn",
  Duplicate: "proposalDecision.Duplicate",
} as const satisfies Record<ProjectProposal["decision"], string>;

const decisionTones = {
  Pending: "amber",
  Approved: "green",
  Denied: "red",
  Withdrawn: "slate",
  Duplicate: "slate",
} as const satisfies Record<ProjectProposal["decision"], "amber" | "green" | "red" | "slate">;

function ProposalsCard({ detail, nameOf }: Omit<ProjectRecordProps, "categories">) {
  const { t } = useTranslation("projects");
  const { project } = detail.row;
  const { proposals } = detail;
  return (
    <DetailCard title={t("projectPage.proposals", { count: proposals.length })}>
      {proposals.length === 0 && (
        <Muted>
          {project.state === "Rejected" ? t("projectPage.none") : t("projectPage.noProposals")}
        </Muted>
      )}
      {proposals.map((proposal) => {
        const flags = [
          proposal.isAfterProjectApproval ? t("projectPage.afterApproval") : null,
          proposal.hasCopy ? t("projectPage.copyExists") : null,
        ].filter((flag) => flag !== null);
        return (
          <DetailRow
            key={proposal.documentId}
            aside={
              <ToneBadge tone={decisionTones[proposal.decision]}>
                {t(decisionLabels[proposal.decision])}
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
            ? t("projectPage.approvedProposalsFinePrint")
            : project.state === "Proposed"
              ? t("projectPage.proposedProposalsFinePrint")
              : t("projectPage.rejectedProposalsFinePrint")}
        </FinePrint>
      )}
    </DetailCard>
  );
}

function ListsCard({ detail }: { detail: ProjectDetail }) {
  const { t } = useTranslation("projects");
  const { lists, formerLists, row } = detail;
  if (row.fundedCount === 0) {
    return null;
  }

  return (
    <DetailCard title={t("projectPage.lists", { count: lists.length + formerLists.length })}>
      {lists.length + formerLists.length === 0 && <Muted>{t("projectPage.noFundedLists")}</Muted>}
      {lists.map(({ list, state, itemCount, pages }) => (
        <DetailRow
          key={list.id}
          aside={
            <span className="grid justify-items-end gap-0.5 text-xs">
              <ListStateBadge state={state} />
              <Muted>
                {t("projectPage.listItemCount", { count: itemCount, pages: formatCount(pages) })}
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
              {t("projectPage.formerListItemCount", { count: itemCount })}
            </span>
          }
        >
          {name} <Muted>· {t("projectPage.noLongerExists")}</Muted>
        </DetailRow>
      ))}
      {lists.length + formerLists.length > 0 && (
        <FinePrint>{t("projectPage.listsFinePrint")}</FinePrint>
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
  const { t } = useTranslation("projects");
  if (funded.length === 0 && row.project.state !== "Approved") {
    return null;
  }

  const document: ColumnDefinition<FundedItem> = {
    key: "document",
    header: "projects:projectPage.document",
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
  const category = column("category", "projects:projectPage.category", (item) => (
    <Muted>{categoryLabelOf(categories, item.iteration.categoryId)}</Muted>
  ));
  const list = column("list", "projects:projectPage.list", (item) => (
    <Muted>{item.listName ?? "—"}</Muted>
  ));
  const pages: ColumnDefinition<FundedItem> = {
    ...column("pages", "projects:projectPage.pages", (item) =>
      item.pages === null ? "—" : formatCount(item.pages),
    ),
    isNumeric: true,
  };
  const status = column("status", "projects:projectPage.status", (item) => (
    <StatusWithFootnote
      status={iterationStatusOf(item.iteration)}
      footnote={statusFootnoteOf(item.iteration)}
    />
  ));

  return (
    <DetailCard title={t("projectPage.whatItFunded", { count: funded.length })}>
      {funded.length === 0 ? (
        <Muted>{t("projectPage.nothingFundedYet")}</Muted>
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
            {t("projectPage.fundedFinePrint")}{" "}
            <Link
              to={`/documents?project=${encodeURIComponent(row.project.id)}`}
              className="text-foreground underline"
            >
              {t("projectPage.openInDocuments")}
            </Link>
            .
          </FinePrint>
        </>
      )}
    </DetailCard>
  );
}
