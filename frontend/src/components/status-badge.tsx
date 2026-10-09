// Status, priority and registry badges in the palette's status tones. The staff and public vocabularies each
// carry their own colours, so a public label never borrows an internal one (view-map.md §4).
// Tones follow docs/demos/shared/vera-model.js.
// TODO(rrandiak): labels move to i18n.

import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import type { RecordStatus } from "@/api/documents";
import { Badge } from "@/components/ui/badge";
import type { Priority, RegistryRecord, RegistryState } from "@/domain/entities";
import type { ListState } from "@/domain/lists";
import type { StatusFootnote } from "@/domain/status";
import { cn } from "@/lib/utils";

const toneVariants = cva("border-transparent", {
  variants: {
    tone: {
      slate: "bg-tone-slate text-tone-slate-foreground",
      blue: "bg-tone-blue text-tone-blue-foreground",
      green: "bg-tone-green text-tone-green-foreground",
      amber: "bg-tone-amber text-tone-amber-foreground",
      red: "bg-tone-red text-tone-red-foreground",
      purple: "bg-tone-purple text-tone-purple-foreground",
      // Forbidden: the one verdict nothing downstream can discharge.
      dark: "bg-black text-white",
    },
  },
});

export type Tone = "slate" | "blue" | "green" | "amber" | "red" | "purple" | "dark";

interface ToneBadgeProps {
  tone: Tone;
  className?: string;
  children: ReactNode;
}

// A small badge in a status tone, for a tag that is not itself a status: "originated", "in use".
export function ToneBadge({ tone, className, children }: ToneBadgeProps) {
  return (
    <Badge className={cn(toneVariants({ tone }), "px-1.5 py-0 text-[0.6875rem]", className)}>
      {children}
    </Badge>
  );
}

const statusTones = {
  Declined: "red",
  Withdrawn: "slate",
  AwaitingReview: "amber",
  BeingAdded: "slate",
  Cancelled: "slate",
  NotDigitizable: "red",
  Forbidden: "dark",
  ValidationDenied: "red",
  ReviewNeeded: "amber",
  Enqueued: "slate",
  IngestFailed: "red",
  Ready: "green",
  Planned: "blue",
  InProgress: "blue",
  Digitized: "green",
  Published: "purple",
  WaitingForReview: "amber",
  NotAccepted: "red",
  BeingChecked: "slate",
  WaitingToBeScheduled: "green",
  Scheduled: "blue",
  Available: "purple",
  OnHold: "slate",
  NotAvailable: "dark",
} as const satisfies Record<RecordStatus, Tone>;

// Only the two priorities that ask for attention carry colour.
const priorityTones = {
  Urgent: "red",
  High: "amber",
  Normal: "slate",
  Low: "slate",
} as const satisfies Record<Priority, Tone>;

interface StatusBadgeProps {
  status: RecordStatus;
  className?: string;
}

// The precedence table's labels (status-model.md §4), then the requester's (view-map.md §4).
const statusLabels = {
  Declined: "Declined",
  Withdrawn: "Withdrawn",
  AwaitingReview: "Awaiting a decision",
  BeingAdded: "Being added",
  Cancelled: "Cancelled",
  NotDigitizable: "Could not be digitized",
  Forbidden: "Forbidden",
  ValidationDenied: "Denied in review",
  ReviewNeeded: "Review needed",
  Enqueued: "Enqueued",
  IngestFailed: "Could not be added",
  Ready: "Ready",
  Planned: "Planned",
  InProgress: "In progress",
  Digitized: "Digitized",
  Published: "Published",
  WaitingForReview: "Waiting for review",
  NotAccepted: "Not accepted",
  BeingChecked: "Being checked",
  WaitingToBeScheduled: "Waiting to be scheduled",
  Scheduled: "Scheduled",
  Available: "Available",
  OnHold: "On hold",
  NotAvailable: "Not available",
} as const satisfies Record<RecordStatus, string>;

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge className={cn(toneVariants({ tone: statusTones[status] }), className)}>
      {statusLabels[status]}
    </Badge>
  );
}

const footnoteLabels = {
  ReviewNeeded: "review needed",
  ValidationDenied: "denied in review",
} as const satisfies Record<StatusFootnote, string>;

interface StatusWithFootnoteProps {
  status: RecordStatus;
  // Once scanned, a new defect rides beside the progress instead of hiding it (status-model §4).
  footnote: StatusFootnote | null;
}

export function StatusWithFootnote({ status, footnote }: StatusWithFootnoteProps) {
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <StatusBadge status={status} />
      {footnote !== null && (
        <span className="text-[0.6875rem] text-muted-foreground">· {footnoteLabels[footnote]}</span>
      )}
    </span>
  );
}

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <Badge className={cn(toneVariants({ tone: priorityTones[priority] }), className)}>
      {priority}
    </Badge>
  );
}

// Someone else's bookkeeping, in its own words where it has them (registry-status.md).
const registryTones = {
  CheckFailed: "red",
  NotFound: "slate",
  Unmapped: "amber",
  Planned: "slate",
  InProgress: "blue",
  Digitized: "green",
  Published: "purple",
} as const satisfies Record<RegistryState, Tone>;

interface RegistryBadgeProps {
  record: RegistryRecord;
  className?: string;
}

export function RegistryBadge({ record, className }: RegistryBadgeProps) {
  return (
    <Badge className={cn(toneVariants({ tone: registryTones[record.state] }), className)}>
      {record.registry}: {record.rawState ?? record.state}
    </Badge>
  );
}

const listStateLabels = {
  Planned: "Planned",
  InProgress: "In progress",
  Done: "Done",
} as const satisfies Record<ListState, string>;

const listStateTones = {
  Planned: "blue",
  InProgress: "blue",
  Done: "green",
} as const satisfies Record<ListState, Tone>;

// A digitization list's state, wherever a list is named: its own page and a project's.
export function ListStateBadge({ state }: { state: ListState }) {
  return <ToneBadge tone={listStateTones[state]}>{listStateLabels[state]}</ToneBadge>;
}
