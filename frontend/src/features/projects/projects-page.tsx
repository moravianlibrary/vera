// Shape: Board.
// The Projects page (docs/demos/shared/page-projects.js index; STATUS "Projects"): few projects
// run at once, so it is not master–detail but cards for the proposed and active (including
// upcoming), with compact tables for the ended and rejected. Each populated category is a
// remembered section unless it is the only one shown. A card or row opens its project.

import type { ProjectRow } from "@vera/contract/projects";
import type { Session } from "@vera/domain/entities";
import { can, hasPermission, scopesOf } from "@vera/domain/permissions";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import type { CardSection } from "@/components/card-sections";
import { CardSections } from "@/components/card-sections";
import { FilterBar } from "@/components/filters/filter-bar";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { failureOf, QueryState } from "@/components/query-state";
import { ToneBadge } from "@/components/status-badge";
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
import { useProjectIndexQuery } from "@/features/projects/use-projects-query";
import { useUsersQuery } from "@/hooks/use-reference-query";
import { useSectionPreferences } from "@/hooks/use-section-preferences";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useViewUrlState } from "@/hooks/use-view-url-state";
import { formatDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";

const projectHref = (row: ProjectRow) => `/projects/${encodeURIComponent(row.project.id)}`;

const projectSectionIds = ["proposed", "active", "ended", "rejected"] as const;
type ProjectSectionId = (typeof projectSectionIds)[number];

const nameColumn: ColumnDefinition<ProjectRow> = {
  key: "project",
  header: "projects:projectsPage.project",
  track: "minmax(12rem,1fr)",
  cell: (row) => (
    <Link to={projectHref(row)} className="font-medium hover:underline">
      {row.project.name}
    </Link>
  ),
};

const periodColumn: ColumnDefinition<ProjectRow> = {
  key: "period",
  header: "projects:projectsPage.period",
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
const target = pagesColumn(
  "target",
  "projects:projectsPage.target",
  (row) => row.intention.targetPages,
);
const planned = pagesColumn("planned", "projects:projectsPage.planned", (row) => row.plannedPages);
const delivered = pagesColumn(
  "delivered",
  "projects:projectsPage.delivered",
  (row) => row.deliveredPages,
);
const result: ColumnDefinition<ProjectRow> = {
  key: "result",
  header: "projects:projectsPage.result",
  track: "max-content",
  cell: (row) => {
    const pace = paceOf(row);
    return pace === null ? null : <ToneBadge tone={pace.tone}>{pace.text}</ToneBadge>;
  },
};

export const endedProjectColumns = {
  notebook: [nameColumn, periodColumn, target, planned, delivered, result],
  small: [nameColumn, target, planned, delivered, result],
  phone: [nameColumn, target, delivered, result],
};

// A rejected project says who rejected it, when and why.
export function rejectedProjectColumns(nameOf: (userId: string) => string) {
  const decided: ColumnDefinition<ProjectRow> = {
    key: "decided",
    header: "projects:projectsPage.decided",
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
    header: "projects:projectsPage.reason",
    track: "minmax(12rem,2fr)",
    cell: (row) =>
      row.project.state === "Rejected" ? (
        <span className="text-muted-foreground">{row.project.reason}</span>
      ) : null,
  };

  return {
    notebook: [nameColumn, periodColumn, reason, decided],
    small: [nameColumn, reason],
  };
}

export function ProjectsPage() {
  const { t } = useTranslation("projects");
  const view = useViewUrlState(projectsView);
  const navigate = useNavigate();
  const [isStarting, setIsStarting] = useState(false);
  const { data: session } = useSessionQuery();
  const indexQuery = useProjectIndexQuery(view.query);
  const { data: index } = indexQuery;
  const { data: users = [] } = useUsersQuery();

  if (session === undefined) {
    return null;
  }

  const nameOf = (userId: string) => users.find((user) => user.id === userId)?.name ?? userId;
  const seesEvery = scopesOf(session, "project.read").includes("any");

  return (
    <>
      <PageHeader
        title={t("projectsPage.title")}
        actions={
          can(session, "project.create")
            ? [
                {
                  id: "new",
                  label: t("projectsPage.newProject"),
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
        searchLabel={t("projectsPage.searchLabel")}
        searchPlaceholder={t("projectsPage.searchPlaceholder")}
      />
      <PageContent>
        {indexQuery.isError ? (
          <>
            <QueryState
              isLoading={false}
              failure={failureOf(indexQuery, t("projectsPage.loadFailure"))}
            >
              <span />
            </QueryState>
            <p className="px-4 text-sm text-muted-foreground">{t("projectsPage.tryAgain")}</p>
          </>
        ) : index === undefined ? null : (
          <ProjectBoard
            key={session.user.id}
            sections={projectSectionsOf(index.rows)}
            isFiltered={Object.keys(view.filter).length > 0}
            seesEvery={seesEvery}
            session={session}
            nameOf={nameOf}
            rejectedColumns={rejectedProjectColumns(nameOf)}
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
  const { t } = useTranslation("projects");
  const { isOpen, setOpen } = useSectionPreferences<ProjectSectionId>("projects");
  const visibleCount = Object.values(sections).filter((rows) => rows.length > 0).length;
  if (visibleCount === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {isFiltered
          ? t("projectsPage.noMatches")
          : seesEvery
            ? t("projectsPage.noneYet")
            : t("projectsPage.noneYouAreOn")}
      </p>
    );
  }

  const isHeadingHidden = visibleCount === 1;
  const cardSections: CardSection<ProjectRow>[] = [
    {
      id: "proposed",
      title: t("projectState.Proposed"),
      items: sections.proposed,
      isHeadingHidden,
      isOpen: isOpen("proposed"),
      onOpenChange: (open) => setOpen("proposed", open),
    },
    {
      id: "active",
      title: sections.active.some((row) => row.period === "Upcoming")
        ? t("projectsPage.activeUpcoming")
        : t("projectPeriod.Active"),
      items: sections.active,
      isHeadingHidden,
      isOpen: isOpen("active"),
      onOpenChange: (open) => setOpen("active", open),
    },
    {
      id: "ended",
      title: t("projectPeriod.Ended"),
      items: sections.ended,
      isHeadingHidden,
      isOpen: isOpen("ended"),
      onOpenChange: (open) => setOpen("ended", open),
      presentation: { table: endedProjectColumns },
    },
    {
      id: "rejected",
      title: t("projectState.Rejected"),
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
