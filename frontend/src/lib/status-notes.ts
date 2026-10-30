// The reason beside a status, readable with no interaction: "{title}: {text}"
// (docs/demos/shared/vera-ui.js noteParts, view-rules.md §4.3), and the desk a record waits on.
// A note is graded by audience: staff read the internal wording where they hold it; a requester
// reads only the public one and nothing of the machinery behind their ask, such as a failed
// ingest or the copies a curator decides over.

import type { Audience, DocumentRecord } from "@vera/domain/documents";
import {
  currentIterationOf,
  followedIterationId,
  iterationOf,
  latestPublicAskOf,
} from "@vera/domain/documents";
import type { Iteration, Request } from "@vera/domain/entities";
import {
  isProgressAtLeast,
  isRestricted,
  outstandingDefects,
  passesGates,
  validationOf,
} from "@vera/domain/status";
import { formatDay } from "@/lib/format-date";

export type NoteTone = "slate" | "amber" | "red" | "blue" | "purple" | "green";

export interface StatusNote {
  tone: NoteTone;
  title: string;
  text: string;
  // Who acted and when, where the note names them.
  actedBy: { actorId: string; at: string } | null;
}

// The text an audience may read: the internal one where it is held, else the public one.
function textFor(audience: Audience, texts: { publicText: string; internalText: string | null }) {
  return audience === "public" ? texts.publicText : (texts.internalText ?? texts.publicText);
}

// What holds or troubles one attempt, first match wins. `request` is the ask it came from,
// which says whether a copy turned up after approval.
export function iterationNoteOf(
  iteration: Iteration,
  request: Request | null,
  audience: Audience,
  instanceNameOf: (id: string) => string = (id) => id,
): StatusNote | null {
  const { cancellation } = iteration;
  if (cancellation !== null) {
    return {
      tone: "slate",
      title: cancellation.cause === "Decided" ? "Cancelled" : "Could not be digitized",
      text: textFor(audience, cancellation),
      actedBy: null,
    };
  }

  if (isRestricted(iteration) && iteration.restriction !== null) {
    return {
      tone: "slate",
      title: "Forbidden",
      text: textFor(audience, iteration.restriction),
      actedBy: null,
    };
  }

  if (iteration.progress === "IngestFailed") {
    // The failure is an administrator's to fix; a requester is told only that it is being added.
    if (audience === "public") {
      return null;
    }

    return {
      tone: "red",
      title: "Could not be added",
      text: iteration.ingestFailure?.error ?? "a curator or an administrator retries it.",
      actedBy: null,
    };
  }

  const validation = validationOf(iteration);
  if (validation === "Denied") {
    const denial = iteration.verdicts.findLast((verdict) => verdict.verdict === "Denied");
    return {
      tone: "red",
      title: audience === "public" ? "On hold" : "Denied in review",
      text:
        audience === "public"
          ? "A problem with the record must be fixed first."
          : (denial?.note ?? "A defect was denied."),
      actedBy: null,
    };
  }

  if (validation === "Needed") {
    const outstanding = outstandingDefects(iteration);
    return {
      tone: "amber",
      title: audience === "public" ? "Being checked" : "Review needed",
      text: outstanding
        .map((defect) =>
          audience === "public"
            ? defect.publicText
            : `${instanceNameOf(defect.instanceId)} ${defect.ruleCode} — ${textFor(audience, defect)}`,
        )
        .join(" "),
      actedBy: null,
    };
  }

  // Existing copies are for whoever decides; a requester is offered the copy itself, never the
  // deliberation over it.
  if (audience === "public" || request?.decision !== "Approved") {
    return null;
  }

  if (request.rescan !== null) {
    return { tone: "blue", title: "Rescan", text: request.rescan.note, actedBy: request.rescan };
  }

  const late = request.existingCopies.find((copy) => copy.foundAfterApproval);
  if (late === undefined) {
    return null;
  }

  return {
    tone: "amber",
    title: "Copy found after approval",
    text: `${late.source}: ${late.state.toLowerCase()}, seen ${formatDay(late.seenAt)}. Nobody has decided over it — check before listing.`,
    actedBy: null,
  };
}

// The note at the top of a staff member's record.
export function staffRecordNoteOf(
  record: DocumentRecord,
  instanceNameOf: (id: string) => string = (id) => id,
): StatusNote | null {
  const current = currentIterationOf(record);
  if (current !== null) {
    const origin = record.requests.find((request) => request.id === current.requestId) ?? null;
    return iterationNoteOf(current, origin, "staff", instanceNameOf);
  }

  // An undecided ask, approve now included, says nothing yet (LC-REQ-approve-now).
  if (record.requests.some((request) => request.decision === "Pending")) {
    return null;
  }

  const isAllDeclined = record.requests.every(
    (request) => request.decision === "Denied" || request.decision === "Withdrawn",
  );
  const declined = record.requests.findLast((request) => request.decision === "Denied");
  if (!isAllDeclined || declined === undefined) {
    return null;
  }

  return {
    tone: "red",
    title: "Declined",
    text: textFor("staff", declined.decline),
    actedBy: declined.decline,
  };
}

// The note at the top of a requester's record, about their latest ask.
export function publicRecordNoteOf(record: DocumentRecord, userId: string): StatusNote | null {
  const latest = latestPublicAskOf(record, userId);
  if (latest === undefined) {
    return null;
  }

  if (latest.decision === "Denied") {
    return {
      tone: "red",
      title: "Not accepted",
      text: latest.decline.publicText,
      actedBy: null,
    };
  }

  if (latest.decision === "Pending") {
    return null;
  }

  if (latest.decision === "Duplicate") {
    return {
      tone: "blue",
      title: "Already being digitized",
      text: "Somebody asked for this first — you are following that work.",
      actedBy: null,
    };
  }

  const iterationId = followedIterationId(latest);
  const iteration = iterationId === null ? null : iterationOf(record, iterationId);
  return iteration === null ? null : iterationNoteOf(iteration, null, "public");
}

// ---------------------------------------------------------------- desk

// The view whose queue a record waits in (view-map.md §4), by navigation entry; null when it
// waits on nobody.
export const desks = ["documents", "requests", "validations", "lists"] as const;
export type Desk = (typeof desks)[number];

export function deskOf(record: DocumentRecord): Desk | null {
  const current = currentIterationOf(record);
  if (current === null) {
    if (record.requests.some((request) => request.decision === "Pending")) {
      return "requests";
    }

    return record.requests.some((request) => request.decision === "Approved") ? "documents" : null;
  }

  // A defect found after the scan goes back to review without hiding the progress.
  if (isProgressAtLeast(current.progress, "Digitized")) {
    return validationOf(current) === "Needed" ? "validations" : null;
  }

  if (current.cancellation !== null || isRestricted(current)) {
    return null;
  }

  if (current.progress === "IngestFailed") {
    return "documents";
  }

  if (current.progress === "Planned" || current.progress === "InProgress") {
    return "lists";
  }

  // Held at a gate, it waits in review; through them, to be added or to be listed.
  if (!passesGates(current)) {
    return "validations";
  }

  return current.progress === "Enqueued" ? "documents" : "lists";
}
