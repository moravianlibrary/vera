// What the pane beside a list shows (component-interfaces.md §4.1): an invitation while nothing
// is selected, nothing while the record loads, a line when the record has left the view, the
// outcome once an action took it off the list, or the record itself. On a phone the pane is a
// sheet that is closed while nothing is selected, so "none" never shows there.

import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { QueryFailure } from "@/components/query-state";
import { QueryError } from "@/components/query-state";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";

export interface Outcome {
  // The record's name, as its heading read.
  title: string;
  tone: "green" | "slate";
  // "Decided".
  heading: string;
  // "Approved into Periodicals at High".
  summary: string;
  // "Open in Documents".
  next?: { label: string; href: string };
}

export type PaneState<Detail> =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "error"; failure: QueryFailure }
  | { kind: "gone"; text: string }
  | { kind: "outcome"; outcome: Outcome }
  | { kind: "ready"; detail: Detail };

// The state of a pane over a lookup: undefined while it loads, a failed lookup, with Try again;
// null once the record is not (or no longer) within the view.
export function paneStateOf<Detail>(
  selectedId: string | null,
  detail: Detail | null | undefined,
  goneText: string,
  failure?: QueryFailure,
): PaneState<Detail> {
  if (selectedId === null) {
    return { kind: "none" };
  }

  if (detail === undefined) {
    return failure === undefined ? { kind: "loading" } : { kind: "error", failure };
  }

  return detail === null ? { kind: "gone", text: goneText } : { kind: "ready", detail };
}

interface PaneProps<Detail> {
  state: PaneState<Detail>;
  emptyIcon: LucideIcon;
  // "Select a document".
  emptyText: string;
  render: (detail: Detail) => ReactNode;
}

export function Pane<Detail>({ state, emptyIcon, emptyText, render }: PaneProps<Detail>) {
  switch (state.kind) {
    case "none":
      return <PaneMessage icon={emptyIcon} text={emptyText} />;
    case "loading":
      return null;
    case "error":
      return (
        <div className="grid h-full place-items-center">
          <QueryError failure={state.failure} />
        </div>
      );
    case "gone":
      return <PaneMessage icon={emptyIcon} text={state.text} />;
    case "outcome":
      return <OutcomeView outcome={state.outcome} />;
    case "ready":
      return render(state.detail);
  }
}

function PaneMessage({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
      <div>
        <Icon className="mx-auto" />
        <p className="mt-3">{text}</p>
      </div>
    </div>
  );
}

function OutcomeView({ outcome }: { outcome: Outcome }) {
  return (
    <article className="max-w-5xl">
      <h2 className="mb-4 text-xl leading-7 font-semibold">{outcome.title}</h2>
      <StatusNote tone={outcome.tone} title={outcome.heading}>
        {outcome.summary}.
      </StatusNote>

      {outcome.next !== undefined && (
        <Button asChild size="sm" variant="outline" className="mt-4">
          <Link to={outcome.next.href}>
            {outcome.next.label}
            <ArrowRight />
          </Link>
        </Button>
      )}
    </article>
  );
}
