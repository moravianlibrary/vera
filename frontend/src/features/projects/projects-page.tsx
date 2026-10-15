// The Projects page (docs/demos/shared/page-projects.js index; STATUS "Projects"): few projects
// run at once, so it is not master–detail but cards for the proposed and active (including
// upcoming), with compact tables for the ended and rejected. Each populated category is a
// remembered section unless it is the only one shown. A card or row opens its project.
// TODO(rrandiak): labels move to i18n.

import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { ProjectRow } from "@/api/projects";
import type { CardSection } from "@/components/card-sections";
import { CardSections } from "@/components/card-sections";
import { FilterBar } from "@/components/filters/filter-bar";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import type { Session } from "@/domain/entities";
import { can, hasPermission, scopesOf } from "@/domain/permissions";
import { useProjectActions } from "@/features/projects/project-actions";
import { ProjectCard } from "@/features/projects/project-card";
import { ProjectFormDialog } from "@/features/projects/project-dialogs";
import type { ProjectSections } from "@/features/projects/projects-view";
import {
  paceOf,
  periodTextOf,
  projectSectionsOf,
  projectsView,
} from "@/features/projects/projects-view";
import { useProjectSectionPreferences } from "@/features/projects/use-project-section-preferences";
import { useProjectIndexQuery } from "@/features/projects/use-projects-query";
import { useUsersQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useViewUrlState } from "@/hooks/use-view-url-state";
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
  pagesOf: (row: ProjectRow) => number | null,
): ColumnDefinition<ProjectRow> => ({
  key,
  header,
  track: "max-content",
  isNumeric: true,
  cell: (row) => {
    const pages = pagesOf(row);
    return pages === null ? <span className="text-muted-foreground">—</span> : formatCount(pages);
  },
});

// Its intention's (projects.md §1.1).
const target = pagesColumn("target", "Target", (row) => row.intention.targetPages);
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
  const view = useViewUrlState(projectsView);
  const navigate = useNavigate();
  const [isStarting, setIsStarting] = useState(false);
  const { data: session } = useSessionQuery();
  const { data: index, error } = useProjectIndexQuery(view.query);
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
      <PageHeader
        title="Projects"
        actions={
          can(session, "project.create")
            ? [
                {
                  id: "new",
                  label: "New project",
                  isPrimary: true,
                  onSelect: () => setIsStarting(true),
                },
              ]
            : []
        }
      />
      <ProjectFormDialog
        isOpen={isStarting}
        onClose={() => setIsStarting(false)}
        row={null}
        onSaved={(detail) => navigate(`/projects/${encodeURIComponent(detail.row.project.id)}`)}
      />
      {hasPermission(session, "watch") && (
        <WatchlistTabs
          view="projects"
          filter={view.filter}
          openedId={view.watchlistId}
          canShare={hasPermission(session, "watchlist.manage_system")}
          onOpen={view.openWatchlist}
          onDetach={view.detachWatchlist}
          isBare={view.isBare}
        />
      )}
      <FilterBar
        key={view.filterReplacements}
        fields={projectsView.fields}
        query={view.query}
        facets={index?.facets}
        onQueryChange={view.setQuery}
        searchLabel="Search projects"
        searchPlaceholder="Search projects — name, description"
      />
      <PageContent>
        {error !== null ? (
          <StatusNote tone="red" title="Projects could not be loaded">
            Try again in a moment.
          </StatusNote>
        ) : index === undefined ? null : (
          <ProjectBoard
            key={session.user.id}
            sections={projectSectionsOf(index.rows)}
            isFiltered={Object.keys(view.filter).length > 0}
            seesEvery={seesEvery}
            session={session}
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
  isFiltered: boolean;
  seesEvery: boolean;
  session: Session;
  nameOf: (userId: string) => string;
  rejectedColumns: {
    notebook: ColumnDefinition<ProjectRow>[];
    small: ColumnDefinition<ProjectRow>[];
  };
  onOpen: (projectId: string) => void;
}

function ProjectBoard({
  sections,
  isFiltered,
  seesEvery,
  session,
  nameOf,
  rejectedColumns,
  onOpen,
}: ProjectBoardProps) {
  const { isOpen, setOpen } = useProjectSectionPreferences(session.user.id);
  const visibleCount = Object.values(sections).filter((rows) => rows.length > 0).length;
  if (visibleCount === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {isFiltered
          ? "No projects match these filters"
          : seesEvery
            ? "None yet"
            : "None you are on"}
      </p>
    );
  }

  const isHeadingHidden = visibleCount === 1;
  const cardSections: CardSection<ProjectRow>[] = [
    {
      id: "proposed",
      title: "Proposed",
      items: sections.proposed,
      isHeadingHidden,
      isOpen: isOpen("proposed"),
      onOpenChange: (open) => setOpen("proposed", open),
    },
    {
      id: "active",
      title: sections.active.some((row) => row.period === "Upcoming")
        ? "Active and upcoming"
        : "Active",
      items: sections.active,
      isHeadingHidden,
      isOpen: isOpen("active"),
      onOpenChange: (open) => setOpen("active", open),
    },
    {
      id: "ended",
      title: "Ended",
      items: sections.ended,
      isHeadingHidden,
      isOpen: isOpen("ended"),
      onOpenChange: (open) => setOpen("ended", open),
      presentation: { table: endedColumns },
    },
    {
      id: "rejected",
      title: "Rejected",
      items: sections.rejected,
      isHeadingHidden,
      isOpen: isOpen("rejected"),
      onOpenChange: (open) => setOpen("rejected", open),
      presentation: { table: rejectedColumns },
    },
  ];

  return (
    <CardSections
      sections={cardSections}
      itemId={(row) => row.project.id}
      renderCard={(row) => <ActionableCard row={row} session={session} nameOf={nameOf} />}
      columns={{ notebook: 2, small: 1, phone: 1 }}
      onOpen={onOpen}
    />
  );
}

interface ActionableCardProps {
  row: ProjectRow;
  session: Session;
  nameOf: (userId: string) => string;
}

// A card with the decision on it, for whoever decides projects.
function ActionableCard({ row, session, nameOf }: ActionableCardProps) {
  const { cardActions, dialogs } = useProjectActions({ row, session });
  return (
    <>
      <ProjectCard row={row} nameOf={nameOf} actions={cardActions} />
      {dialogs}
    </>
  );
}
