// The shared header for a submitted batch in Documents and Requests.

import type { Batch, User } from "@vera/domain/entities";
import type { ReactNode } from "react";
import { GroupHeader } from "@/components/lists/group-header";
import { AgentBadge } from "@/components/status-badge";
import { formatDay } from "@/lib/format-date";

interface BatchGroupHeaderProps {
  batch: Batch | null;
  users: readonly User[];
  lone: { title: string; meta: string };
  counts: ReactNode;
  action?: ReactNode;
  footnote?: ReactNode;
}

export function BatchGroupHeader({
  batch,
  users,
  lone,
  counts,
  action,
  footnote,
}: BatchGroupHeaderProps) {
  if (batch === null) {
    return <GroupHeader title={lone.title} meta={lone.meta} action={action} footnote={footnote} />;
  }

  const submitter = users.find((user) => user.id === batch.submittedBy);
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
          {formatDay(batch.submittedAt)} ·{" "}
          <UserName user={submitter} fallback={batch.submittedBy} />
          {batch.source !== null && (
            <span className="text-muted-foreground"> · from {batch.source.name}</span>
          )}
          {" · "}
          {counts}
        </>
      }
      action={action}
      footnote={footnote}
    />
  );
}

export function UserName({ user, fallback }: { user: User | undefined; fallback: string }) {
  return (
    <>
      {user?.name ?? fallback}
      {user?.kind === "agent" && (
        <>
          {" "}
          <AgentBadge />
        </>
      )}
    </>
  );
}
