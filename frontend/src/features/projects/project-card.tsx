// One project on the Projects page (docs/demos/shared/page-projects.js card; projects.md §1.1,
// §4): its decision and period as two badges, the pace once approved, who runs it, what it is
// for, the bars against its target, and across the foot what waits on it: the proposals a
// decision would act on, the lists carrying its items, its members, and what is approved but on
// no list yet. The target, planned, delivered and pace are its own intention's, the one number
// kept in one place; a project with no target draws the time alone.

import type { ProjectRow } from "@vera/contract/projects";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import type { ViewAction } from "@/components/actions/action-bar";
import { RecordCard } from "@/components/card-sections";
import { ProjectStateBadge, ToneBadge } from "@/components/status-badge";
import { PaceBars } from "@/components/visualizations/pace-bars";
import {
  paceOf,
  pagesOf,
  periodTextOf,
  periodTones,
  targetTextOf,
  timeLabelOf,
} from "@/features/projects/projects-view";
import { i18n } from "@/i18n";
import { formatPages } from "@/lib/format-number";

interface ProjectCardProps {
  row: ProjectRow;
  nameOf: (userId: string) => string;
  actions?: readonly ViewAction[];
}

export function ProjectCard({ row, nameOf, actions }: ProjectCardProps) {
  const { t } = useTranslation("projects");
  const { project } = row;
  const meta = [
    periodTextOf(project),
    targetTextOf(row),
    t("projectCard.managedBy", { name: nameOf(project.managerId) }),
    project.state === "Approved" ? t("projectCard.priority", { priority: project.priority }) : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <RecordCard
      title={project.name}
      href={`/projects/${encodeURIComponent(project.id)}`}
      meta={meta}
      badges={<ProjectBadges row={row} />}
      body={
        <>
          {project.description !== "" && (
            <p className="-mt-1 text-ui text-muted-foreground">{project.description}</p>
          )}
          <PaceBars
            target={row.intention.targetPages ?? 0}
            timeElapsed={row.timeElapsed}
            timeLabel={timeLabelOf(row)}
            pages={pagesOf(row)}
            evenPace={row.evenPace}
          />
        </>
      }
      actions={actions}
      foot={<ProjectFoot row={row} />}
    />
  );
}

// A rejected project's period says nothing anybody acts on.
export function ProjectBadges({ row }: { row: ProjectRow }) {
  const { project } = row;
  const pace = paceOf(row);
  return (
    <>
      <ProjectStateBadge state={project.state} />
      {project.state !== "Rejected" && (
        <ToneBadge tone={periodTones[row.period]}>
          {i18n.t(`projects:projectPeriod.${row.period}`)}
        </ToneBadge>
      )}
      {pace !== null && <ToneBadge tone={pace.tone}>{pace.text}</ToneBadge>}
    </>
  );
}

function ProjectFoot({ row }: { row: ProjectRow }) {
  const { t } = useTranslation("projects");
  const { project, pending, waiting } = row;
  const groupNames = row.memberGroups.map((group) => group.name).join(", ");
  const members = [t("projectCard.member", { count: project.memberIds.length }), groupNames || null]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <>
      {[
        {
          key: "pending",
          part:
            project.state !== "Proposed" ? null : pending.documentCount === 0 ? (
              t("projectCard.noProposals")
            ) : (
              <>
                <b className="font-medium text-foreground">
                  {t("projectCard.pending", { count: pending.documentCount })}
                </b>
                {pending.withCopyCount > 0 &&
                  ` · ${t("projectCard.withCopy", { count: pending.withCopyCount })}`}
              </>
            ),
        },
        {
          key: "lists",
          part: row.listCount > 0 ? t("projectCard.list", { count: row.listCount }) : null,
        },
        { key: "members", part: members },
        {
          key: "waiting",
          part:
            waiting.itemCount === 0 ? null : (
              <>
                <b className="font-medium text-foreground">{formatPages(waiting.pages)}</b>{" "}
                {t("projectCard.approvedNotListed")}
              </>
            ),
        },
      ]
        .filter(({ part }) => part !== null)
        .map(({ key, part }, index) => (
          <Fragment key={key}>
            {index > 0 && " · "}
            {part}
          </Fragment>
        ))}
    </>
  );
}
