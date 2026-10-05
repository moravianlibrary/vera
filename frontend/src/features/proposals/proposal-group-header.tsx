// The header over a group of Proposals rows (page-proposals.js groupHead). A batch says how it
// came in, who sent it and when, how many of its asks are listed, and how many sit on rows
// listed with an earlier ask; it carries the bulk approve, with what that leaves out. A
// requester says how many documents they asked for first.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import type { ProposalGroup } from "@/api/proposal-review";
import { ToneBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { Batch, User } from "@/domain/entities";
import { formatDay } from "@/lib/format-date";

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
  return (
    <div className="border-t-2 border-b border-l-4 border-t-muted-foreground border-l-primary bg-muted px-4 py-3 text-xs @2xl:col-span-full">
      {group.kind === "batch" ? (
        <BatchHeading group={group} users={users} onBulkApprove={onBulkApprove} />
      ) : (
        <RequesterHeading group={group} users={users} />
      )}
    </div>
  );
}

interface BatchHeadingProps {
  group: BatchGroup;
  users: readonly User[];
  onBulkApprove?: (group: BatchGroup) => void;
}

function BatchHeading({ group, users, onBulkApprove }: BatchHeadingProps) {
  const { batch } = group;
  if (batch === null) {
    return (
      <>
        <Title>Proposed one at a time</Title>
        <Subtitle>not part of a batch</Subtitle>
      </>
    );
  }

  const submitter = users.find((user) => user.id === batch.submittedBy);
  const leftOut = [
    group.rescanCount > 0 &&
      `${group.rescanCount} ${group.rescanCount === 1 ? "rescan" : "rescans"}`,
    group.checkingCount > 0 && `${group.checkingCount} still being checked`,
  ].filter(Boolean);
  return (
    <>
      <Title>
        <b className="font-mono font-bold">{batch.id}</b>{" "}
        <span className="text-muted-foreground">
          {batchViaLabels[batch.via]} · {batch.name}
        </span>
      </Title>
      <Subtitle>
        <UserName user={submitter} fallback={batch.submittedBy} /> · {formatDay(batch.submittedAt)}{" "}
        · {group.askCount} asked
        {group.elsewhereCount > 0 && (
          <>
            {" · "}
            <b className="font-semibold text-foreground">{group.elsewhereCount}</b> listed with{" "}
            {group.elsewhereCount === 1 ? "its" : "their"} earlier ask
          </>
        )}
      </Subtitle>
      {group.approvableCount > 0 && onBulkApprove !== undefined && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button size="xs" onClick={() => onBulkApprove(group)}>
            Approve {group.approvableCount}…
          </Button>
          {leftOut.length > 0 && (
            <span className="text-muted-foreground">{leftOut.join(" · ")} left out</span>
          )}
        </div>
      )}
    </>
  );
}

function RequesterHeading({ group, users }: { group: RequesterGroup; users: readonly User[] }) {
  const user = users.find((candidate) => candidate.id === group.userId);
  return (
    <>
      <Title>
        <b className="font-bold">
          <UserName user={user} fallback={group.userId} />
        </b>
      </Title>
      <Subtitle>
        {group.total} {group.total === 1 ? "document" : "documents"}
        {group.sharedCount > 0 && ` · ${group.sharedCount} asked for by others too`}
      </Subtitle>
    </>
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

function Title({ children }: { children: ReactNode }) {
  return <div className="text-sm leading-snug">{children}</div>;
}

function Subtitle({ children }: { children: ReactNode }) {
  return <div className="mt-1 text-muted-foreground">{children}</div>;
}
