// The header over a group of Documents rows (docs/demos/shared/page-documents.js, byBatch and
// byProject). A batch says when and by whom it came in and how much of it could not be added,
// the unit an admin retries; a project says its state and how many of its documents match.
// TODO(rrandiak): retrying a batch's failed additions; labels move to i18n.

import type { ReactNode } from "react";
import { Link } from "react-router";
import type { DocumentGroup } from "@/api/documents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Project, User } from "@/domain/entities";
import { cn } from "@/lib/utils";

const submittedFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

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
  return (
    <div className="border-t-2 border-b border-l-4 border-t-muted-foreground border-l-primary bg-muted px-4 py-3 text-xs @2xl:col-span-full">
      {group.kind === "batch" ? (
        <BatchHeading group={group} users={users} canRetryAdditions={canRetryAdditions} />
      ) : (
        <ProjectHeading group={group} canOpenProjects={canOpenProjects} />
      )}
    </div>
  );
}

interface BatchHeadingProps {
  group: Extract<DocumentGroup, { kind: "batch" }>;
  users: readonly User[];
  canRetryAdditions: boolean;
}

function BatchHeading({ group, users, canRetryAdditions }: BatchHeadingProps) {
  const { batch, size, failed } = group;
  if (batch === null) {
    return (
      <>
        <Title>Not from a batch</Title>
        <Subtitle>asked for one at a time, or still a proposal</Subtitle>
      </>
    );
  }

  const submitter = users.find((user) => user.id === batch.submittedBy)?.name ?? batch.submittedBy;
  return (
    <>
      <Title>
        <b className="font-mono font-bold">{batch.id}</b>{" "}
        <span className="text-muted-foreground">{batch.name}</span>
      </Title>
      <Subtitle>
        {submittedFormat.format(new Date(batch.submittedAt))} · {submitter} ·{" "}
        {failed > 0 ? (
          <b className="font-semibold text-tone-red-foreground">
            {failed} of {size} could not be added
          </b>
        ) : (
          `${size} added`
        )}
      </Subtitle>
      {failed > 0 && canRetryAdditions && (
        <div className="mt-2">
          <Button variant="outline" size="xs" className="bg-background">
            {failed === 1 ? "Retry the failed one" : "Retry failed"}
          </Button>
        </div>
      )}
    </>
  );
}

interface ProjectHeadingProps {
  group: Extract<DocumentGroup, { kind: "project" }>;
  canOpenProjects: boolean;
}

function ProjectHeading({ group, canOpenProjects }: ProjectHeadingProps) {
  const { project, total } = group;
  const count = `${total} ${total === 1 ? "document" : "documents"}`;
  if (project === null) {
    return (
      <>
        <Title>No project</Title>
        <Subtitle>{count}</Subtitle>
      </>
    );
  }

  return (
    <>
      <Title>
        <b className="font-bold">{project.name}</b>{" "}
        <Badge
          className={cn(
            "ml-1 border-transparent px-1.5 py-0 text-[0.625rem]",
            projectStateTones[project.state],
          )}
        >
          {project.state}
        </Badge>
      </Title>
      <Subtitle>
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
      </Subtitle>
    </>
  );
}

function Title({ children }: { children: ReactNode }) {
  return <div className="text-sm leading-snug">{children}</div>;
}

function Subtitle({ children }: { children: ReactNode }) {
  return <div className="mt-1 text-muted-foreground">{children}</div>;
}
