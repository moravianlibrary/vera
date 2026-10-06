// The header over a group of Documents rows (docs/demos/shared/page-documents.js, byBatch and
// byProject), on the shared GroupHeader frame. A batch says when and by whom it came in and how
// far adding it got (decided 2026-10-06: added, being added and could not be added, each
// counted, so a retry or a new batch does not read as all added), the unit an admin retries; a project says its state and how
// many of its documents match. An administrator retries a batch's failed additions from its
// header, at once and without a dialog: a retry only sends them back to ingest.
// TODO(rrandiak): on a phone the retry moves into the header's "…" (component-interfaces.md
// §2.3); labels move to i18n.

import { useState } from "react";
import { Link } from "react-router";
import { retryBatch } from "@/api/additions";
import type { DocumentGroup } from "@/api/documents";
import { GroupHeader } from "@/components/lists/group-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Project, User } from "@/domain/entities";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import type { Refusal } from "@/hooks/use-action-mutation";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";
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
  const { batch, size, added, adding, failed } = group;
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
          <AdditionCounts size={size} added={added} adding={adding} failed={failed} />
        </>
      }
      action={
        failed > 0 && canRetryAdditions ? (
          <RetryFailedButton batchId={batch.id} failed={failed} />
        ) : undefined
      }
    />
  );
}

interface AdditionCountsProps {
  size: number;
  added: number;
  adding: number;
  failed: number;
}

// "28 added · 12 being added · 3 could not be added", each part only when it counts something;
// "40 added" once all of it is in.
function AdditionCounts({ size, added, adding, failed }: AdditionCountsProps) {
  if (added === size) {
    return `${size} added`;
  }

  const parts = [
    added > 0 && <span key="added">{added} added</span>,
    adding > 0 && <span key="adding">{adding} being added</span>,
    failed > 0 && (
      <b key="failed" className="font-semibold text-tone-red-foreground">
        {failed} could not be added
      </b>
    ),
  ].filter(Boolean);
  if (parts.length === 0) {
    return "none added yet";
  }

  return parts.flatMap((part, index) => (index === 0 ? [part] : [" · ", part]));
}

// The footnote says a refusal; success needs no word, as the refetch takes the failures off.
function RetryFailedButton({ batchId, failed }: { batchId: string; failed: number }) {
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const retry = useActionMutation({
    call: retryBatch,
    invalidates: [documentsQueryKey, watchlistsQueryKey],
    refusalTexts: {
      403: "Only an administrator retries additions.",
      409: "Nothing in this batch is waiting for a retry any more.",
    },
  });

  const run = async () => {
    setRefusal(null);
    const result = await retry.run(batchId);
    if (!result.isDone) {
      setRefusal(result.refusal);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="xs"
        className="bg-background"
        disabled={retry.isPending}
        onClick={() => void run()}
      >
        {retry.isPending ? "Retrying…" : failed === 1 ? "Retry the failed one" : "Retry failed"}
      </Button>
      {refusal !== null && (
        <span role="alert" className="text-destructive">
          {refusal.message}
        </span>
      )}
    </>
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
