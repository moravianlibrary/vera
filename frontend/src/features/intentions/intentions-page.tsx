// The Intentions page: one filtered board, repeats then running, upcoming, ended and archived.
// `?i=` opens one card, marks it and scrolls to it, `?t=` marks one repeat. *New intention* and
// *Edit* need `intention.edit`, *New repeat* and a repeat's *Edit* `intention.repeat`; what was
// done is said above the columns, and the card it was done to is marked. Whoever builds lists,
// while a generator runs, starts one from a card (intentions.md §4.4): shaped by it, with the
// pages a behind-pace target is short, or a correcting run's allocation for a tracking card out
// of the band. Its mix line links to Categories with its `?i=`: *Edit mix* where the person may
// edit the owner's, *Proportions* otherwise.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { IntentionIndex, IntentionRow, IntentionTemplateRow } from "@/api/intentions";
import { archiveIntention } from "@/api/intentions";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import type { CardSection } from "@/components/card-sections";
import { CardSections } from "@/components/card-sections";
import { FilterBar } from "@/components/filters/filter-bar";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import { StatusNote } from "@/components/status-note";
import type { Session } from "@/domain/entities";
import { scopeOfIntention } from "@/domain/intentions";
import { can, hasPermission } from "@/domain/permissions";
import type { NoteTone } from "@/domain/status-notes";
import type { MixLink } from "@/features/intentions/intention-card";
import { IntentionCard } from "@/features/intentions/intention-card";
import type { IntentionSource } from "@/features/intentions/intention-dialogs";
import {
  CorrectionDialog,
  DeleteIntentionDialog,
  IntentionFormDialog,
  TemplateFormDialog,
} from "@/features/intentions/intention-dialogs";
import {
  intentionBoardSectionsOf,
  intentionFacets,
  intentionsView,
  matchingIntentions,
} from "@/features/intentions/intentions-board-view";
import {
  columnOf,
  columnTitles,
  everyLabels,
  periodNouns,
} from "@/features/intentions/intentions-view";
import { intentionMixHrefOf } from "@/features/intentions/mix-view";
import { useIntentionSectionPreferences } from "@/features/intentions/use-intention-section-preferences";
import {
  intentionInvalidations,
  useIntentionIndexQuery,
} from "@/features/intentions/use-intentions-query";
import { generationHrefOf } from "@/features/lists/lists-view";
import { useListGeneratorsQuery } from "@/features/lists/use-lists-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useProjectsQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useViewUrlState } from "@/hooks/use-view-url-state";
import { formatCalendarDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { cn } from "@/lib/utils";

type OpenDialog =
  | { kind: "intention"; source: IntentionSource }
  | { kind: "delete"; row: IntentionRow }
  | { kind: "template"; row: IntentionTemplateRow | null }
  | { kind: "correct"; row: IntentionRow }
  | null;

interface Note {
  tone: NoteTone;
  title: string;
  text: string;
}

// What the person may do here, and to each intention.
export interface IntentionActs {
  cardActionsOf: (row: IntentionRow) => ViewAction[];
  // Null when the person may not set repeats.
  editTemplate: ((row: IntentionTemplateRow) => void) | null;
  // To its Mix (`/intentions/:id/mix`).
  mixLinkOf: (row: IntentionRow) => MixLink | null;
}

export function IntentionsPage() {
  const view = useViewUrlState(intentionsView, "i");
  const { data: index, error } = useIntentionIndexQuery();
  const { data: session } = useSessionQuery();
  const { data: projects = [] } = useProjectsQuery();
  const [params, setParams] = useSearchParams();
  const canGenerate = session !== undefined && can(session, "list.create");
  const { data: generators = [] } = useListGeneratorsQuery({ isEnabled: canGenerate });
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [note, setNote] = useState<Note | null>(null);
  const archive = useActionMutation({
    call: archiveIntention,
    invalidates: intentionInvalidations,
  });

  const focus = (intentionId: string | null, said: Note, row?: IntentionRow) => {
    setNote(said);
    const next = new URLSearchParams(params);
    next.delete("i");
    next.delete("t");
    if (
      row !== undefined &&
      matchingIntentions({ rows: [row], templates: [] }, view.query).rows.length === 0
    ) {
      for (const key of intentionsView.toSearchParams(view.query).keys()) next.delete(key);
      next.delete("watchlist");
    }
    if (intentionId !== null) next.set("i", intentionId);
    setParams(next, { replace: true });
  };
  const canEdit = (row: IntentionRow) =>
    session !== undefined &&
    can(session, "intention.edit", scopeOfIntention(row.intention, projects));
  const toggleArchived = async (row: IntentionRow) => {
    const { intention } = row;
    const result = await archive.run(intention.id);
    if (!result.isDone) {
      setNote({
        tone: "red",
        title: `${intention.name} was not changed`,
        text: result.refusal.message,
      });
      return;
    }

    focus(intention.id, {
      tone: "green",
      title: `Archived ${intention.name}.`,
      text: "Its definition and displayed results are preserved.",
    });
  };
  const generateActionOf = (row: IntentionRow): ViewAction | null => {
    const { intention } = row;
    if (
      !canGenerate ||
      generators.length === 0 ||
      row.state === "Ended" ||
      intention.archived !== null
    ) {
      return null;
    }

    const isTracking = intention.targetPages === null;
    if (isTracking && row.outputPages > 0 && row.outOfBandCount > 0) {
      return {
        id: "generate",
        label: "Generate correcting list…",
        onSelect: () => setDialog({ kind: "correct", row }),
      };
    }

    const catchUp = row.verdict === "behindPace" ? (row.catchUpPages ?? 0) : 0;
    return {
      id: "generate",
      label:
        catchUp > 0
          ? `Generate catch-up — ${formatCount(catchUp)} pp`
          : isTracking && row.mix !== null
            ? "Generate against this mix"
            : "Generate a list",
      href: generationHrefOf({
        intentionId: intention.id,
        pages: catchUp > 0 ? catchUp : null,
        allocation: null,
      }),
    };
  };
  const acts: IntentionActs = {
    cardActionsOf: (row) => {
      const generate = generateActionOf(row);
      const { intention } = row;
      const isMet = intention.targetPages !== null && row.deliveredPages >= intention.targetPages;
      // A project's own goes with its project (intentions.md §3.4).
      const isArchivable =
        !intention.isOverall &&
        intention.projectId === null &&
        (row.state === "Ended" || isMet || intention.targetPages === null);
      const edits: ViewAction[] =
        canEdit(row) && intention.archived === null
          ? [
              {
                id: "edit",
                label: "Edit",
                onSelect: () => setDialog({ kind: "intention", source: { kind: "edit", row } }),
              },
              ...(isArchivable
                ? [{ id: "archive", label: "Archive", onSelect: () => void toggleArchived(row) }]
                : []),
            ]
          : [];
      return [...(generate === null ? [] : [generate]), ...edits];
    },
    editTemplate:
      session !== undefined && can(session, "intention.repeat")
        ? (row) => setDialog({ kind: "template", row })
        : null,
    mixLinkOf: (row) => {
      if (session === undefined || row.mix === null) {
        return null;
      }

      return {
        label: "View output comparison",
        href: intentionMixHrefOf(row.intention.id, row.intention.scopeCategoryId),
      };
    },
  };
  const headerActions: ViewAction[] =
    session === undefined
      ? []
      : [
          ...(can(session, "intention.repeat")
            ? [
                {
                  id: "repeat",
                  label: "New repeat",
                  onSelect: () => setDialog({ kind: "template", row: null }),
                },
              ]
            : []),
          ...(can(session, "intention.edit")
            ? [
                {
                  id: "new",
                  label: "New intention",
                  isPrimary: true,
                  onSelect: () => setDialog({ kind: "intention", source: { kind: "new" } }),
                },
              ]
            : []),
        ];
  const close = () => setDialog(null);

  return (
    <>
      <PageHeader title="Intentions" actions={headerActions} />
      {session !== undefined && hasPermission(session, "watch") && (
        <WatchlistTabs
          view="intentions"
          filter={view.filter}
          openedId={view.watchlistId}
          canShare={hasPermission(session, "watchlist.manage_system")}
          onOpen={view.openWatchlist}
          onDetach={view.detachWatchlist}
          isBare={view.isBare}
        />
      )}
      <FilterBar
        key={view.filterReplacements}
        fields={intentionsView.fields}
        query={view.query}
        facets={index === undefined ? undefined : intentionFacets(index, view.query)}
        onQueryChange={view.setQuery}
        searchLabel="Search intentions"
        searchPlaceholder="Search intentions and repeats"
      />
      <PageContent>
        {error !== null ? (
          <StatusNote tone="red" title="Intentions could not be loaded">
            Try again in a moment.
          </StatusNote>
        ) : index === undefined ? null : (
          <>
            {note !== null && (
              <StatusNote tone={note.tone} title={note.title} className="mb-4">
                {note.text}
              </StatusNote>
            )}
            {session !== undefined && (
              <IntentionBoard
                key={session.user.id}
                index={matchingIntentions(index, view.query)}
                allTemplates={index.templates}
                isFiltered={Object.keys(view.filter).length > 0}
                focusedId={params.get("i")}
                focusedTemplateId={params.get("t")}
                acts={acts}
                session={session}
              />
            )}
          </>
        )}
      </PageContent>
      {index !== undefined && session !== undefined && (
        <PageDialogs
          dialog={dialog}
          index={index}
          session={session}
          onClose={close}
          onOpen={setDialog}
          onDone={focus}
        />
      )}
    </>
  );
}

interface PageDialogsProps {
  dialog: OpenDialog;
  index: IntentionIndex;
  session: Session;
  onClose: () => void;
  onOpen: (dialog: OpenDialog) => void;
  onDone: (intentionId: string | null, note: Note, row?: IntentionRow) => void;
}

function PageDialogs({ dialog, index, session, onClose, onOpen, onDone }: PageDialogsProps) {
  const navigate = useNavigate();
  if (dialog === null) {
    return null;
  }

  if (dialog.kind === "correct") {
    return (
      <CorrectionDialog
        isOpen
        onClose={onClose}
        row={dialog.row}
        onAccept={(pages, allocation) =>
          navigate(generationHrefOf({ intentionId: dialog.row.intention.id, pages, allocation }))
        }
      />
    );
  }

  if (dialog.kind === "template") {
    return (
      <TemplateFormDialog
        isOpen
        onClose={onClose}
        row={dialog.row}
        rows={index.rows}
        session={session}
      />
    );
  }

  if (dialog.kind === "delete") {
    const { intention } = dialog.row;
    return (
      <DeleteIntentionDialog
        isOpen
        onClose={onClose}
        row={dialog.row}
        onDeleted={() =>
          onDone(null, {
            tone: "green",
            title: `Deleted ${intention.name}.`,
            text: "No list changed.",
          })
        }
      />
    );
  }

  const { source } = dialog;
  const edited = source.kind === "edit" ? source.row : null;
  const isTrackedByRepeat = (row: IntentionRow) =>
    index.templates.some((template) => template.tracks?.id === row.intention.id);
  const isDeletable =
    edited !== null &&
    !edited.intention.isOverall &&
    edited.intention.projectId === null &&
    (edited.mix?.trackerCount ?? 0) === 0 &&
    !isTrackedByRepeat(edited);
  return (
    <IntentionFormDialog
      key={`${source.kind}-${edited?.intention.id ?? ""}`}
      isOpen
      onClose={onClose}
      source={source}
      rows={index.rows}
      session={session}
      onSaved={(row) =>
        onDone(
          row.intention.id,
          edited === null
            ? {
                tone: "green",
                title: `Created ${row.intention.name}.`,
                text: `${columnTitles[columnOf(row.intention)]} · ${row.state.toLowerCase()}. Nothing to attach — whatever matches its scope counts.`,
              }
            : {
                tone: "green",
                title: `Saved ${row.intention.name}.`,
                text: "Its counts are worked out again over its whole window.",
              },
          row,
        )
      }
      onCopy={
        edited === null
          ? undefined
          : () => onOpen({ kind: "intention", source: { kind: "copy", row: edited } })
      }
      onDelete={
        isDeletable && edited !== null ? () => onOpen({ kind: "delete", row: edited }) : undefined
      }
    />
  );
}

type BoardItem =
  | { kind: "intention"; row: IntentionRow }
  | { kind: "repeat"; row: IntentionTemplateRow };

interface IntentionBoardProps {
  index: IntentionIndex;
  allTemplates: readonly IntentionTemplateRow[];
  isFiltered: boolean;
  focusedId: string | null;
  focusedTemplateId: string | null;
  acts: IntentionActs;
  session: Session;
}

function IntentionBoard({
  index,
  allTemplates,
  isFiltered,
  focusedId,
  focusedTemplateId,
  acts,
  session,
}: IntentionBoardProps) {
  const { isOpen, setOpen } = useIntentionSectionPreferences(session.user.id);
  const sections = intentionBoardSectionsOf(index);
  const visibleCount = Object.values(sections).filter((items) => items.length > 0).length;
  const isHeadingHidden = visibleCount === 1;
  const everyOf = (row: IntentionRow) =>
    allTemplates.find((template) => template.template.id === row.intention.templateId)?.template
      .every ?? null;
  const isFocusedIn = (id: keyof typeof sections) =>
    id === "repeats"
      ? sections.repeats.some((row) => row.template.id === focusedTemplateId)
      : sections[id].some((row) => row.intention.id === focusedId);
  const repeatSection = (id: "repeats", title: string): CardSection<BoardItem> => ({
    id,
    title,
    items: sections.repeats.map((row) => ({ kind: "repeat", row })),
    isHeadingHidden,
    isOpen: isOpen(id) || isFocusedIn(id),
    onOpenChange: (open) => setOpen(id, open),
  });
  const intentionSection = (
    id: "running" | "upcoming" | "ended" | "archived",
    title: string,
  ): CardSection<BoardItem> => ({
    id,
    title,
    items: sections[id].map((row) => ({ kind: "intention", row })),
    isHeadingHidden,
    isOpen: isOpen(id) || isFocusedIn(id),
    onOpenChange: (open) => setOpen(id, open),
  });
  const cardSections: CardSection<BoardItem>[] = [
    repeatSection("repeats", "Repeats"),
    intentionSection("running", "Running"),
    intentionSection("upcoming", "Upcoming"),
    intentionSection("ended", "Ended"),
    intentionSection("archived", "Archived"),
  ];

  return (
    <div className="grid gap-6">
      {visibleCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isFiltered
            ? "No intentions or repeats match these filters"
            : "No intentions or repeats yet."}
        </p>
      ) : (
        <CardSections
          sections={cardSections}
          itemId={(item) => (item.kind === "repeat" ? item.row.template.id : item.row.intention.id)}
          renderCard={(item) =>
            item.kind === "repeat" ? (
              <RepeatLine
                row={item.row}
                isFocused={item.row.template.id === focusedTemplateId}
                onEdit={acts.editTemplate}
              />
            ) : (
              <IntentionCard
                row={item.row}
                repeatEvery={everyOf(item.row)}
                isOpen={item.row.intention.id === focusedId}
                actions={acts.cardActionsOf(item.row)}
                mixLink={acts.mixLinkOf(item.row)}
              />
            )
          }
          columns={{ notebook: 2, small: 1, phone: 1 }}
          focusedId={focusedId ?? focusedTemplateId}
        />
      )}
      <p className="rounded-md border border-dashed bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        <b className="text-foreground">Nothing is attached to an intention.</b> An item counts
        towards every intention whose project scope and category it matches, when its list starts
        inside the window — so one page can count towards a grant, a regional target and Overall
        output at once. Those figures overlap and are never added.
        <br />
        <b className="text-foreground">Planned and delivered are plan completion</b>: what was put
        on lists in the window, and how much of that was digitized in it.{" "}
        <b className="text-foreground">Output</b> is everything digitized in the window, whenever it
        was planned — what a mix is measured on.
        <br />
        <b className="text-foreground">The counting start is fixed once created.</b> To count from
        another date, make a new intention from the old one.
      </p>
    </div>
  );
}

// A repeat has its own address, `?t=`, which Schedules and the Tasks trigger link to.
function RepeatLine({
  row,
  isFocused,
  onEdit,
}: {
  row: IntentionTemplateRow;
  isFocused: boolean;
  onEdit: ((row: IntentionTemplateRow) => void) | null;
}) {
  const { template } = row;
  const [before, after = ""] = template.namePattern.split("{period}");
  const parts: ReactNode[] = [
    everyLabels[template.every].toLowerCase(),
    template.targetPages === null ? null : `${formatCount(template.targetPages)} pp`,
    row.tracks === null ? "own mix" : `tracks ${row.tracks.name}`,
    `next ${formatCalendarDay(template.nextOn)}`,
    template.isArchivingPrevious ? "archives the previous one" : null,
  ].filter((part) => part !== null);
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-dashed px-3 py-2 text-[0.8125rem]",
        isFocused && "outline-2 outline-offset-2 outline-ring",
      )}
    >
      <span className="min-w-0 flex-1">
        ↻{" "}
        <b className="font-semibold">
          {before}
          <i>{periodNouns[template.every]}</i>
          {after}
        </b>{" "}
        <span className="text-muted-foreground">· {parts.join(" · ")}</span>
      </span>
      {onEdit !== null && (
        <ActionBar actions={[{ id: "edit", label: "Edit", onSelect: () => onEdit(row) }]} />
      )}
    </div>
  );
}
