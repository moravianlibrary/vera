// The header over a group of Requests rows (page-proposals.js groupHead). A batch says how it
// came in, who sent it and when, how many of its asks are listed, and how many sit on rows
// listed with an earlier ask; it carries the bulk approve, with what that leaves out. A
// requester says how many documents they asked for first. On the shared GroupHeader frame.
// TODO(rrandiak): labels move to i18n.

import type { RequestGroup } from "@vera/contract/requests";
import type { User } from "@vera/domain/entities";
import { BatchGroupHeader, UserName } from "@/components/lists/batch-group-header";
import { GroupHeader } from "@/components/lists/group-header";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/plural";

type BatchGroup = Extract<RequestGroup, { kind: "batch" }>;
type RequesterGroup = Extract<RequestGroup, { kind: "requester" }>;

interface RequestGroupHeaderProps {
  group: RequestGroup;
  users: readonly User[];
  onBulkApprove?: (group: BatchGroup) => void;
}

export function RequestGroupHeader({ group, users, onBulkApprove }: RequestGroupHeaderProps) {
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
  const leftOut = [
    group.rescanCount > 0 && plural(group.rescanCount, "rescan"),
    group.checkingCount > 0 && `${group.checkingCount} still being checked`,
  ].filter(Boolean);
  const canBulkApprove = group.approvableCount > 0 && onBulkApprove !== undefined;
  return (
    <BatchGroupHeader
      batch={batch}
      users={users}
      lone={{ title: "Proposed one at a time", meta: "not part of a batch" }}
      counts={
        <>
          {group.askCount} asked
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
        batch !== null && canBulkApprove ? (
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
