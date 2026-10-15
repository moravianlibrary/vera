// The header over a group of Documents rows (docs/demos/shared/page-documents.js, byBatch and
// byProject), on the shared GroupHeader frame. A batch says when and by whom it came in and how
// far adding it got (decided 2026-10-06: each document counted once, by the status its row
// shows, so a retry or a new batch does not read as all added, what a gate holds does not read
// as being added, and the parts add up to the batch), the unit retried; a project says its state
// and how many of its documents match. A holder of `request.retry` retries a batch's failed
// additions in their scope from its header (ACT-retry-batch), at once and without a dialog: a retry only sends them back to ingest.
// TODO(rrandiak): on a phone the retry moves into the header's "…" (component-interfaces.md
// §2.3); labels move to i18n.

import { useState } from "react";
import { Link } from "react-router";
import { retryBatch } from "@/api/additions";
import type { DocumentGroup } from "@/api/documents";
import { GroupHeader } from "@/components/lists/group-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdditionState } from "@/domain/documents";
import { additionStates } from "@/domain/documents";
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
  const { batch, size, additions } = group;
  // A batch of one is listed with what was asked for on its own (ENT-batch).
  if (batch === null) {
    return <GroupHeader title="One at a time" meta="asked for on its own, or still a proposal" />;
  }

  const submitter = users.find((user) => user.id === batch.submittedBy)?.name ?? batch.submittedBy;
  return (
    <GroupHeader
      title={
        <>
          <b className="font-semibold">
            Batch <span className="font-mono">{batch.id}</span>
          </b>{" "}
          <span className="font-normal text-foreground">· {batch.name}</span>
        </>
      }
      meta={
        <>
          {formatDay(batch.submittedAt)} · {submitter} ·{" "}
          <AdditionCounts size={size} additions={additions} />
        </>
      }
      action={
        additions.failed > 0 && canRetryAdditions ? (
          <RetryFailedButton batchId={batch.id} failed={additions.failed} />
        ) : undefined
      }
    />
  );
}

interface AdditionCountsProps {
  size: number;
  additions: Readonly<Record<AdditionState, number>>;
}

const additionLabels = {
  awaiting: "awaiting a decision",
  declined: "declined",
  withdrawn: "withdrawn",
  forbidden: "forbidden",
  reviewNeeded: "review needed",
  deniedInReview: "denied in review",
  adding: "being added",
  failed: "could not be added",
  added: "added",
  cancelled: "cancelled",
} as const satisfies Record<AdditionState, string>;

// "4 awaiting a decision · 1 forbidden · 12 being added · 3 could not be added · 28 added", each
// part only when it counts something, in the order a document moves; "40 added" once all of it
// is in.
function AdditionCounts({ size, additions }: AdditionCountsProps) {
  if (additions.added === size) {
    return `${size} added`;
  }

  const parts = additionStates
    .filter((state) => additions[state] > 0)
    .map((state) =>
      state === "failed" ? (
        <b key={state} className="font-semibold text-tone-red-foreground">
          {additions[state]} {additionLabels[state]}
        </b>
      ) : (
        <span key={state}>
          {additions[state]} {additionLabels[state]}
        </span>
      ),
    );
  if (parts.length === 0) {
    return "none added";
  }

  return parts.flatMap((part, index) => (index === 0 ? [part] : [" · ", part]));
}

// The footnote says a refusal; success needs no word, as the refetch takes the failures off.
export function RetryFailedButton({ batchId, failed }: { batchId: string; failed: number }) {
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const retry = useActionMutation({
    call: retryBatch,
    invalidates: [documentsQueryKey, watchlistsQueryKey],
    refusalTexts: {
      403: "What failed is outside your custody.",
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
              "ml-1 border-foreground/20 px-1.5 py-0 text-[0.625rem]",
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
