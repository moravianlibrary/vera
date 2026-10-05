// Where a proposal stands, as the list and the pane say it (page-proposals.js statusOf): decided
// one way or the other, still being checked, held because approval was asked for over a copy,
// or awaiting review.
// TODO(rrandiak): labels move to i18n.

import type { Tone } from "@/components/status-badge";
import { ToneBadge } from "@/components/status-badge";
import type { ProposalRow } from "@/domain/proposal-review";
import { isBeingChecked, isHeld } from "@/domain/proposal-review";

const proposalStatuses = {
  declined: { tone: "red", label: "Declined" },
  withdrawn: { tone: "slate", label: "Withdrawn" },
  beingChecked: { tone: "slate", label: "Being checked" },
  held: { tone: "amber", label: "Asked to be added" },
  awaitingReview: { tone: "amber", label: "Awaiting review" },
} as const satisfies Record<string, { tone: Tone; label: string }>;

type ProposalStatus = keyof typeof proposalStatuses;

function proposalStatusOf(row: ProposalRow): ProposalStatus {
  if (row.decision === "Denied") {
    return "declined";
  }

  if (row.decision === "Withdrawn") {
    return "withdrawn";
  }

  if (isBeingChecked(row)) {
    return "beingChecked";
  }

  return isHeld(row) ? "held" : "awaitingReview";
}

export function ProposalStatusBadge({ row }: { row: ProposalRow }) {
  const { tone, label } = proposalStatuses[proposalStatusOf(row)];
  return <ToneBadge tone={tone}>{label}</ToneBadge>;
}
