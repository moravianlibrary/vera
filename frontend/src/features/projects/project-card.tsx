// One project on the Projects page (docs/demos/shared/page-projects.js card; projects.md §4): its
// decision and period as two badges, the pace once approved, who runs it, what it is for, the
// bars against its target, and across the foot what waits on it: the proposals a decision would
// act on, the lists carrying its items, its members, and what is approved but on no list yet.
// TODO(rrandiak): *No intention yet — Create one* waits for intentions (plan.md step 6); labels
// move to i18n.

import { Fragment } from "react";
import type { ProjectRow } from "@/api/projects";
import type { ViewAction } from "@/components/actions/action-bar";
import { RecordCard } from "@/components/card-sections";
import { ToneBadge } from "@/components/status-badge";
import { PaceBars } from "@/components/visualizations/pace-bars";
import {
  decisionTones,
  paceOf,
  pagesOf,
  periodTextOf,
  periodTones,
  timeLabelOf,
} from "@/features/projects/projects-view";
import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";

interface ProjectCardProps {
  row: ProjectRow;
  nameOf: (userId: string) => string;
  actions?: readonly ViewAction[];
}

export function ProjectCard({ row, nameOf, actions }: ProjectCardProps) {
  const { project } = row;
  const meta = [
    periodTextOf(project),
    `target ${formatCount(project.targetPages)} pp`,
    `managed by ${nameOf(project.managerId)}`,
    project.state === "Approved" ? `${project.priority} priority` : null,
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
            <p className="-mt-1 text-[0.8125rem] text-muted-foreground">{project.description}</p>
          )}
          <PaceBars
            target={project.targetPages}
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
      <ToneBadge tone={decisionTones[project.state]}>{project.state}</ToneBadge>
      {project.state !== "Rejected" && (
        <ToneBadge tone={periodTones[row.period]}>{row.period}</ToneBadge>
      )}
      {pace !== null && <ToneBadge tone={pace.tone}>{pace.text}</ToneBadge>}
    </>
  );
}

function ProjectFoot({ row }: { row: ProjectRow }) {
  const { project, pending, waiting } = row;
  const groupNames = row.memberGroups.map((group) => group.name).join(", ");
  const members = [plural(project.memberIds.length, "member"), groupNames || null]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <>
      {[
        {
          key: "pending",
          part:
            project.state !== "Proposed" ? null : pending.documentCount === 0 ? (
              "No proposals in it yet"
            ) : (
              <>
                <b className="font-medium text-foreground">{pending.documentCount} pending</b>
                {pending.withCopyCount > 0 &&
                  ` · ${pending.withCopyCount} with a copy (will be skipped)`}
              </>
            ),
        },
        { key: "lists", part: row.listCount > 0 ? plural(row.listCount, "list") : null },
        { key: "members", part: members },
        {
          key: "waiting",
          part:
            waiting.itemCount === 0 ? null : (
              <>
                <b className="font-medium text-foreground">{formatCount(waiting.pages)} pp</b>{" "}
                approved, not on a list
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
