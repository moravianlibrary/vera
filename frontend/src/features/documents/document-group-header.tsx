// The header over a group of Documents rows (docs/demos/shared/page-documents.js, byBatch and
// byProject), on the shared GroupHeader frame. A batch says when and by whom it came in and how
// much of it could not be added, the unit an admin retries; a project says its state and how
// many of its documents match.
// TODO(rrandiak): retrying a batch's failed additions; labels move to i18n.

import { Link } from "react-router";
import type { DocumentGroup } from "@/api/documents";
import { GroupHeader } from "@/components/lists/group-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Project, User } from "@/domain/entities";
import { formatDay } from "@/lib/format-date";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";

const projectStateTones = {
  Proposed: "bg-tone-amber text-tone-amber-foreground",
  Approved: "bg-tone-green text-tone-green-foreground",
  Rejected: "bg-tone-red text-tone-red-foreground",
} as const satisfies Record<Project["state"], string>;

interface DocumentGroupHeaderProps {
  group: DocumentGroup;
  users: readonly User[];
  canRetryAdditions: boolean;
  canOpenProjects: boolean;
}

export function DocumentGroupHeader({
  group,
  users,
  canRetryAdditions,
  canOpenProjects,
}: DocumentGroupHeaderProps) {
  return group.kind === "batch" ? (
    <BatchHeader group={group} users={users} canRetryAdditions={canRetryAdditions} />
  ) : (
    <ProjectHeader group={group} canOpenProjects={canOpenProjects} />
  );
}

interface BatchHeaderProps {
  group: Extract<DocumentGroup, { kind: "batch" }>;
  users: readonly User[];
  canRetryAdditions: boolean;
}

function BatchHeader({ group, users, canRetryAdditions }: BatchHeaderProps) {
  const { batch, size, failed } = group;
  if (batch === null) {
    return (
      <GroupHeader title="Not from a batch" meta="asked for one at a time, or still a proposal" />
    );
  }

  const submitter = users.find((user) => user.id === batch.submittedBy)?.name ?? batch.submittedBy;
  return (
    <GroupHeader
      title={
        <>
          <b className="font-mono font-bold">{batch.id}</b>{" "}
          <span className="text-muted-foreground">{batch.name}</span>
        </>
      }
      meta={
        <>
          {formatDay(batch.submittedAt)} · {submitter} ·{" "}
          {failed > 0 ? (
            <b className="font-semibold text-tone-red-foreground">
              {failed} of {size} could not be added
            </b>
          ) : (
            `${size} added`
          )}
        </>
      }
      action={
        failed > 0 && canRetryAdditions ? (
          <Button variant="outline" size="xs" className="bg-background">
            {failed === 1 ? "Retry the failed one" : "Retry failed"}
          </Button>
        ) : undefined
      }
    />
  );
}

interface ProjectHeaderProps {
  group: Extract<DocumentGroup, { kind: "project" }>;
  canOpenProjects: boolean;
}

function ProjectHeader({ group, canOpenProjects }: ProjectHeaderProps) {
  const { project, total } = group;
  const count = plural(total, "document");
  if (project === null) {
    return <GroupHeader title="No project" meta={count} />;
  }

  return (
    <GroupHeader
      title={
        <>
          <b className="font-bold">{project.name}</b>{" "}
          <Badge
            className={cn(
              "ml-1 border-transparent px-1.5 py-0 text-[0.625rem]",
              projectStateTones[project.state],
            )}
          >
            {project.state}
          </Badge>
        </>
      }
      meta={
        <>
          {count}
          {canOpenProjects && (
            <>
              {" · "}
              <Link
                to={`/projects?id=${encodeURIComponent(project.id)}`}
                className="underline underline-offset-2 hover:text-foreground"
              >
                open the project
              </Link>
            </>
          )}
        </>
      }
    />
  );
}
