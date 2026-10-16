// Where a proposal stands, as the list and the pane say it (page-proposals.js statusOf): decided
// one way or the other, still being checked, or awaiting a decision (LC-REQ-approve-now: approve
// now leaves nothing held apart).
// TODO(rrandiak): labels move to i18n.

import type { RequestRow } from "@vera/domain/requests";
import { isBeingChecked } from "@vera/domain/requests";
import type { Tone } from "@/components/status-badge";
import { ToneBadge } from "@/components/status-badge";

const requestStatuses = {
  declined: { tone: "red", label: "Declined" },
  withdrawn: { tone: "slate", label: "Withdrawn" },
  beingChecked: { tone: "slate", label: "Being checked" },
  awaitingReview: { tone: "amber", label: "Awaiting a decision" },
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
  return <ToneBadge tone={tone}>{label}</ToneBadge>;
}
