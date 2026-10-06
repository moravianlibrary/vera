// The header over a group of Proposals rows (page-proposals.js groupHead). A batch says how it
// came in, who sent it and when, how many of its asks are listed, and how many sit on rows
// listed with an earlier ask; it carries the bulk approve, with what that leaves out. A
// requester says how many documents they asked for first. On the shared GroupHeader frame.
// TODO(rrandiak): labels move to i18n.

import type { ProposalGroup } from "@/api/proposal-review";
import { GroupHeader } from "@/components/lists/group-header";
import { ToneBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { Batch, User } from "@/domain/entities";
import { formatDay } from "@/lib/format-date";
import { plural } from "@/lib/plural";

type BatchGroup = Extract<ProposalGroup, { kind: "batch" }>;
type RequesterGroup = Extract<ProposalGroup, { kind: "requester" }>;

export const batchViaLabels = {
  file: "file",
  pastedList: "pasted list",
  barcodeScan: "barcode scan",
  harvest: "harvest",
} as const satisfies Record<Batch["via"], string>;

interface ProposalGroupHeaderProps {
  group: ProposalGroup;
  users: readonly User[];
  onBulkApprove?: (group: BatchGroup) => void;
}

export function ProposalGroupHeader({ group, users, onBulkApprove }: ProposalGroupHeaderProps) {
  return group.kind === "batch" ? (
    <BatchHeader group={group} users={users} onBulkApprove={onBulkApprove} />
  ) : (
    <RequesterHeader group={group} users={users} />
  );
}

interface BatchHeaderProps {
  group: BatchGroup;
  users: readonly User[];
  onBulkApprove?: (group: BatchGroup) => void;
}

function BatchHeader({ group, users, onBulkApprove }: BatchHeaderProps) {
  const { batch } = group;
  if (batch === null) {
    return <GroupHeader title="Proposed one at a time" meta="not part of a batch" />;
  }

  const submitter = users.find((user) => user.id === batch.submittedBy);
  const leftOut = [
    group.rescanCount > 0 && plural(group.rescanCount, "rescan"),
    group.checkingCount > 0 && `${group.checkingCount} still being checked`,
  ].filter(Boolean);
  const canBulkApprove = group.approvableCount > 0 && onBulkApprove !== undefined;
  return (
    <GroupHeader
      title={
        <>
          <b className="font-mono font-bold">{batch.id}</b>{" "}
          <span className="text-muted-foreground">
            {batchViaLabels[batch.via]} · {batch.name}
          </span>
        </>
      }
      meta={
        <>
          <UserName user={submitter} fallback={batch.submittedBy} /> ·{" "}
          {formatDay(batch.submittedAt)} · {group.askCount} asked
          {group.elsewhereCount > 0 && (
            <>
              {" · "}
              <b className="font-semibold text-foreground">{group.elsewhereCount}</b> listed with{" "}
              {group.elsewhereCount === 1 ? "its" : "their"} earlier ask
            </>
          )}
        </>
      }
      action={
        canBulkApprove ? (
          <Button size="xs" onClick={() => onBulkApprove(group)}>
            Approve {group.approvableCount}…
          </Button>
        ) : undefined
      }
      footnote={leftOut.length > 0 ? `${leftOut.join(" · ")} left out` : undefined}
    />
  );
}

function RequesterHeader({ group, users }: { group: RequesterGroup; users: readonly User[] }) {
  const user = users.find((candidate) => candidate.id === group.userId);
  return (
    <GroupHeader
      title={
        <b className="font-bold">
          <UserName user={user} fallback={group.userId} />
        </b>
      }
      meta={
        <>
          {plural(group.total, "document")}
          {group.sharedCount > 0 && ` · ${group.sharedCount} asked for by others too`}
        </>
      }
    />
  );
}

function UserName({ user, fallback }: { user: User | undefined; fallback: string }) {
  return (
    <>
      {user?.name ?? fallback}
      {user?.kind === "agent" && (
        <>
          {" "}
          <ToneBadge tone="purple">agent</ToneBadge>
        </>
      )}
    </>
  );
}
