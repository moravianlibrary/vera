// Status, priority and registry badges in the palette's status tones. The staff and public vocabularies each
// carry their own colours, so a public label never borrows an internal one (view-map.md §4).
// Tones follow docs/demos/shared/vera-model.js.

import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import type { RecordStatus } from "@/api/documents";
import { Badge } from "@/components/ui/badge";
import type { Priority, RegistryRecord, RegistryState } from "@/domain/entities";
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
      dark: "bg-primary text-primary-foreground",
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

// TODO(rrandiak): show the i18n label instead of the status key.
export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge className={cn(toneVariants({ tone: statusTones[status] }), className)}>{status}</Badge>
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
