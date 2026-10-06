// The Projects page (docs/demos/shared/page-projects.js index; STATUS "Projects"): few projects
// run at once, so it is not master–detail but cards for the proposed, active and upcoming ones,
// and compact tables below for the ended and the rejected, there for the audit that asks years
// later. A card or a row opens the project's own page.
// TODO(rrandiak): labels move to i18n.

import { Link, useNavigate } from "react-router";
import type { ProjectRow } from "@/api/projects";
import type { CardSection } from "@/components/card-sections";
import { CardSections } from "@/components/card-sections";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { can, scopesOf } from "@/domain/permissions";
import { ProjectCard } from "@/features/projects/project-card";
import type { ProjectSections } from "@/features/projects/projects-view";
import { paceOf, periodTextOf, projectSectionsOf } from "@/features/projects/projects-view";
import { useProjectIndexQuery } from "@/features/projects/use-projects-query";
import { useUsersQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { formatDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";

const projectHref = (row: ProjectRow) => `/projects/${encodeURIComponent(row.project.id)}`;

const nameColumn: ColumnDefinition<ProjectRow> = {
  key: "project",
  header: "Project",
  track: "minmax(12rem,1fr)",
  cell: (row) => (
    <Link to={projectHref(row)} className="font-medium hover:underline">
      {row.project.name}
    </Link>
  ),
};

const periodColumn: ColumnDefinition<ProjectRow> = {
  key: "period",
  header: "Period",
  track: "max-content",
  cell: (row) => <span className="text-muted-foreground">{periodTextOf(row.project)}</span>,
};

const pagesColumn = (
  key: string,
  header: string,
  pagesOf: (row: ProjectRow) => number,
): ColumnDefinition<ProjectRow> => ({
  key,
  header,
  track: "max-content",
  isNumeric: true,
  cell: (row) => formatCount(pagesOf(row)),
});

const target = pagesColumn("target", "Target", (row) => row.project.targetPages);
const planned = pagesColumn("planned", "Planned", (row) => row.plannedPages);
const delivered = pagesColumn("delivered", "Delivered", (row) => row.deliveredPages);
const result: ColumnDefinition<ProjectRow> = {
  key: "result",
  header: "Result",
  track: "max-content",
  cell: (row) => {
    const pace = paceOf(row);
    return pace === null ? null : <ToneBadge tone={pace.tone}>{pace.text}</ToneBadge>;
  },
};

const endedColumns = {
  notebook: [nameColumn, periodColumn, target, planned, delivered, result],
  small: [nameColumn, target, planned, delivered, result],
  phone: [nameColumn, target, delivered, result],
};

export function ProjectsPage() {
  const navigate = useNavigate();
  const { data: session } = useSessionQuery();
  const { data: index, error } = useProjectIndexQuery();
  const { data: users = [] } = useUsersQuery();

  if (session === undefined) {
    return null;
  }

  const nameOf = (userId: string) => users.find((user) => user.id === userId)?.name ?? userId;
  const decided: ColumnDefinition<ProjectRow> = {
    key: "decided",
    header: "Decided",
    track: "max-content",
    cell: (row) =>
      row.project.state === "Rejected" ? (
        <span className="text-muted-foreground">
          {formatDay(row.project.at)} · {nameOf(row.project.actorId)}
        </span>
      ) : null,
  };
  const reason: ColumnDefinition<ProjectRow> = {
    key: "reason",
    header: "Reason",
    track: "minmax(12rem,2fr)",
    cell: (row) =>
      row.project.state === "Rejected" ? (
        <span className="text-muted-foreground">{row.project.reason}</span>
      ) : null,
  };
  const seesEvery =
    can(session, "project.decide") || scopesOf(session, "project.read").includes("any");

  return (
    <>
      <PageHeader title="Projects" />
      <PageContent>
        {error !== null ? (
          <StatusNote tone="red" title="Projects could not be loaded">
            Try again in a moment.
          </StatusNote>
        ) : index === undefined ? null : (
          <ProjectBoard
            sections={projectSectionsOf(index.rows)}
            seesEvery={seesEvery}
            nameOf={nameOf}
            rejectedColumns={{
              notebook: [nameColumn, periodColumn, reason, decided],
              small: [nameColumn, reason],
            }}
            onOpen={(projectId) => navigate(`/projects/${encodeURIComponent(projectId)}`)}
          />
        )}
      </PageContent>
    </>
  );
}

interface ProjectBoardProps {
  sections: ProjectSections;
  seesEvery: boolean;
  nameOf: (userId: string) => string;
  rejectedColumns: {
    notebook: ColumnDefinition<ProjectRow>[];
    small: ColumnDefinition<ProjectRow>[];
  };
  onOpen: (projectId: string) => void;
}

function ProjectBoard({ sections, seesEvery, nameOf, rejectedColumns, onOpen }: ProjectBoardProps) {
  const { counts } = sections;
  const tile =
    [
      counts.proposed > 0 ? `${counts.proposed} proposed` : null,
      counts.active > 0 ? `${counts.active} active` : null,
      counts.upcoming > 0 ? `${counts.upcoming} upcoming` : null,
      counts.ended > 0 ? `${counts.ended} ended` : null,
    ]
      .filter((part) => part !== null)
      .join(" · ") || (seesEvery ? "None yet" : "None you are on");
  const cardSections: CardSection<ProjectRow>[] = [
    {
      id: "running",
      items: sections.cards,
      emptyText: "No project is running, about to start, or waiting for a decision.",
    },
    { id: "ended", title: "Ended", items: sections.ended, presentation: { table: endedColumns } },
    {
      id: "rejected",
      title: "Rejected",
      items: sections.rejected,
      isCollapsedByDefault: true,
      presentation: { table: rejectedColumns },
    },
  ];

  return (
    <CardSections
      sections={cardSections}
      itemId={(row) => row.project.id}
      renderCard={(row) => <ProjectCard row={row} nameOf={nameOf} />}
      columns={{ notebook: 2, small: 1, phone: 1 }}
      tile={tile}
      onOpen={onOpen}
    />
  );
}
