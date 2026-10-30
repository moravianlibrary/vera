// Where a proposal stands, as the list and the pane say it (page-proposals.js statusOf): decided
// one way or the other, still being checked, or awaiting a decision (LC-REQ-approve-now: approve
// now leaves nothing held apart).

import type { RequestRow } from "@vera/domain/requests";
import { isBeingChecked } from "@vera/domain/requests";
import type { Tone } from "@/components/status-badge";
import { ToneBadge } from "@/components/status-badge";
import { i18n } from "@/i18n";

const requestStatuses = {
  declined: { tone: "red", label: "requests:status.declined" },
  withdrawn: { tone: "slate", label: "requests:status.withdrawn" },
  beingChecked: { tone: "slate", label: "requests:status.beingChecked" },
  awaitingReview: { tone: "amber", label: "requests:status.awaitingDecision" },
} as const satisfies Record<string, { tone: Tone; label: string }>;

type RequestStatus = keyof typeof requestStatuses;

function requestStatusOf(row: RequestRow): RequestStatus {
  if (row.decision === "Denied") {
    return "declined";
  }

  if (row.decision === "Withdrawn") {
    return "withdrawn";
  }

  if (isBeingChecked(row)) {
    return "beingChecked";
  }

  return "awaitingReview";
}

export function RequestStatusBadge({ row }: { row: RequestRow }) {
  const { tone, label } = requestStatuses[requestStatusOf(row)];
  return <ToneBadge tone={tone}>{i18n.t(label)}</ToneBadge>;
}
