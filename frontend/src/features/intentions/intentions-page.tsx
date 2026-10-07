// The Intentions page (docs/demos/shared/page-intentions.js; STATUS "Intentions"; component-
// interfaces.md §1.4): what VERA is trying to digitize, as two columns of cards, Targets and
// Tracking, each running → upcoming with Ended and Archived folded below. The repeats head the
// Targets column. Where only one column fits, a Targets / Tracking switch picks it (`?col=track`);
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
import { archiveIntention, unarchiveIntention } from "@/api/intentions";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import type { CardSection } from "@/components/card-sections";
import { CardSections } from "@/components/card-sections";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Session } from "@/domain/entities";
import { scopeOfIntention } from "@/domain/intentions";
import { can } from "@/domain/permissions";
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
import type { IntentionColumn } from "@/features/intentions/intentions-view";
import {
  columnOf,
  columnSectionsOf,
  columnTitles,
  everyLabels,
  intentionColumns,
  intentionsUrlStateOf,
  periodNouns,
  shortWindowOf,
  tileOf,
  verdictBadgeOf,
} from "@/features/intentions/intentions-view";
import { intentionMixHrefOf } from "@/features/intentions/mix-view";
import {
  intentionInvalidations,
  useIntentionIndexQuery,
} from "@/features/intentions/use-intentions-query";
import { generationHrefOf } from "@/features/lists/lists-view";
import { useListGeneratorsQuery } from "@/features/lists/use-lists-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useProjectsQuery, useUsersQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useTier } from "@/hooks/use-tier";
import { formatCalendarDay, formatDay } from "@/lib/format-date";
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
  foldActionOf: (row: IntentionRow) => ViewAction | null;
  // Null when the person may not set repeats.
  editTemplate: ((row: IntentionTemplateRow) => void) | null;
  // To its Mix (`/intentions/:id/mix`).
  mixLinkOf: (row: IntentionRow) => MixLink | null;
}

export function IntentionsPage() {
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
  const unarchive = useActionMutation({
    call: unarchiveIntention,
    invalidates: intentionInvalidations,
  });

  const focus = (intentionId: string | null, said: Note) => {
    setNote(said);
    setParams(intentionId === null ? {} : { i: intentionId }, { replace: true });
  };
  const canEdit = (row: IntentionRow) =>
    session !== undefined &&
    can(session, "intention.edit", scopeOfIntention(row.intention, projects));
  const toggleArchived = async (row: IntentionRow) => {
    const { intention } = row;
    const isArchiving = intention.archived === null;
    const result = await (isArchiving ? archive : unarchive).run(intention.id);
    if (!result.isDone) {
      setNote({
        tone: "red",
        title: `${intention.name} was not changed`,
        text: result.refusal.message,
      });
      return;
    }

    focus(
      intention.id,
      isArchiving
        ? {
            tone: "green",
            title: `Archived ${intention.name}.`,
            text: "Only off the page — its counts are unchanged.",
          }
        : { tone: "green", title: `Unarchived ${intention.name}.`, text: "Back on the page." },
    );
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
          : isTracking
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
      const edits: ViewAction[] = canEdit(row)
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
    foldActionOf: (row) =>
      canEdit(row) && !row.intention.isOverall && row.intention.projectId === null
        ? {
            id: "archive",
            label: row.intention.archived === null ? "Archive" : "Unarchive",
            onSelect: () => void toggleArchived(row),
          }
        : null,
    editTemplate:
      session !== undefined && can(session, "intention.repeat")
        ? (row) => setDialog({ kind: "template", row })
        : null,
    mixLinkOf: (row) => {
      if (session === undefined) {
        return null;
      }

      // The mix is edited on its owner (intentions.md §2.5); anyone else only reads it there. A
      // tracker's Mix shows its owner's, with the way to it.
      const owner = index?.rows.find(
        (candidate) => candidate.intention.id === row.mix.owner.id,
      )?.intention;
      const canEditMix = row.mix.owner.isOverall
        ? can(session, "intention.edit_overall")
        : owner !== undefined && can(session, "intention.edit", scopeOfIntention(owner, projects));
      return {
        label: canEditMix ? "Edit mix" : "Proportions",
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
            <IntentionBoard index={index} acts={acts} params={params} setParams={setParams} />
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
  onDone: (intentionId: string | null, note: Note) => void;
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
    edited.mix.trackerCount === 0 &&
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

interface IntentionBoardProps {
  index: IntentionIndex;
  acts: IntentionActs;
  params: URLSearchParams;
  setParams: ReturnType<typeof useSearchParams>[1];
}

function IntentionBoard({ index, acts, params, setParams }: IntentionBoardProps) {
  const tier = useTier();
  const urlState = intentionsUrlStateOf(params, index.rows);
  const isOneColumn = tier === "phone" || tier === "small";
  const shown = isOneColumn ? [urlState.column] : intentionColumns;

  return (
    <div className="grid gap-6">
      {isOneColumn && (
        <Tabs
          value={urlState.column}
          onValueChange={(value) =>
            setParams(value === "track" ? { col: "track" } : {}, { replace: true })
          }
        >
          <TabsList>
            {intentionColumns.map((column) => (
              <TabsTrigger key={column} value={column}>
                {columnTitles[column]}
                <span className="ml-1 tabular-nums opacity-70">
                  {
                    index.rows.filter(
                      (row) =>
                        columnOf(row.intention) === column && row.intention.archived === null,
                    ).length
                  }
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <div className={cn("grid items-start gap-6", !isOneColumn && "grid-cols-2")}>
        {shown.map((column) => (
          <IntentionColumnView
            key={column}
            column={column}
            rows={index.rows}
            templates={column === "target" ? index.templates : []}
            focusedId={urlState.focusedId}
            focusedTemplateId={urlState.focusedTemplateId}
            acts={acts}
          />
        ))}
      </div>
      <p className="rounded-md border border-dashed bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        <b className="text-foreground">Nothing is attached to an intention.</b> An item counts
        towards every intention whose funding and category it matches, when its list starts inside
        the window — so one page can count towards a grant, a regional target and the house mix at
        once. Those figures overlap and are never added.
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

interface IntentionColumnViewProps {
  column: IntentionColumn;
  rows: readonly IntentionRow[];
  templates: readonly IntentionTemplateRow[];
  focusedId: string | null;
  focusedTemplateId: string | null;
  acts: IntentionActs;
}

function IntentionColumnView({
  column,
  rows,
  templates,
  focusedId,
  focusedTemplateId,
  acts,
}: IntentionColumnViewProps) {
  const { data: users = [] } = useUsersQuery();
  const sections = columnSectionsOf(rows, column);
  const isFocusedIn = (items: readonly IntentionRow[]) =>
    items.some((row) => row.intention.id === focusedId);
  const everyOf = (row: IntentionRow) =>
    templates.find((template) => template.template.id === row.intention.templateId)?.template
      .every ?? null;
  const archivedBy = (row: IntentionRow) => {
    const actor = row.intention.archived?.actor;
    if (actor?.kind === "system") {
      return "VERA (repeat)";
    }

    return actor?.kind === "user"
      ? (users.find((user) => user.id === actor.userId)?.name ?? actor.userId)
      : "";
  };
  const fold = (
    id: "ended" | "archived",
    title: string,
    items: IntentionRow[],
  ): CardSection<IntentionRow> => ({
    id,
    title,
    items,
    isCollapsedByDefault: !isFocusedIn(items),
    presentation: { table: { notebook: foldColumns(id, archivedBy, acts.foldActionOf) } },
  });
  const cardSections: CardSection<IntentionRow>[] = [
    { id: "running", items: sections.running, emptyText: "Nothing running." },
    { id: "upcoming", title: "Upcoming", items: sections.upcoming },
    fold("ended", "Ended", sections.ended),
    fold("archived", "Archived", sections.archived),
  ];

  return (
    <section className="grid min-w-0 gap-3.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-2">
        <h2 className="text-base font-semibold">{columnTitles[column]}</h2>
        <Tile column={column} sections={sections} />
      </div>
      {templates.map((row) => (
        <RepeatLine
          key={row.template.id}
          row={row}
          isFocused={row.template.id === focusedTemplateId}
          onEdit={acts.editTemplate}
        />
      ))}
      <CardSections
        sections={cardSections}
        itemId={(row) => row.intention.id}
        renderCard={(row) => (
          <IntentionCard
            row={row}
            repeatEvery={everyOf(row)}
            isOpen={row.intention.id === focusedId}
            actions={acts.cardActionsOf(row)}
            mixLink={acts.mixLinkOf(row)}
          />
        )}
        columns={{ notebook: 1 }}
        focusedId={focusedId}
      />
    </section>
  );
}

function Tile({
  column,
  sections,
}: {
  column: IntentionColumn;
  sections: ReturnType<typeof columnSectionsOf>;
}) {
  return (
    <div className="text-[0.8125rem] text-muted-foreground">
      {tileOf(sections, column).map((part, index) => (
        <span key={part.key}>
          {index > 0 && " · "}
          {part.count !== null && (
            <b
              className={cn(
                "font-semibold text-foreground",
                part.isAlert && "text-tone-red-foreground",
              )}
            >
              {part.count}
            </b>
          )}{" "}
          {part.label}
        </span>
      ))}
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

function foldColumns(
  kind: "ended" | "archived",
  archivedBy: (row: IntentionRow) => string,
  actionOf: (row: IntentionRow) => ViewAction | null,
): ColumnDefinition<IntentionRow>[] {
  return [
    {
      key: "intention",
      header: "Intention",
      track: "minmax(10rem,1fr)",
      cell: (row) => (
        <>
          <span className="font-medium">{row.intention.name}</span>
          {row.intention.templateId !== null && <span className="text-muted-foreground"> ↻</span>}
          <div className="text-xs text-muted-foreground">{shortWindowOf(row.intention)}</div>
        </>
      ),
    },
    {
      key: "result",
      header: "Result",
      track: "max-content",
      isNumeric: true,
      cell: (row) =>
        row.intention.targetPages === null
          ? `${formatCount(row.outputPages)} pp output`
          : `${formatCount(row.deliveredPages)} / ${formatCount(row.intention.targetPages)} pp`,
    },
    {
      key: "status",
      header: kind === "archived" ? "Archived" : "",
      track: "max-content",
      cell: (row) => {
        const verdict = verdictBadgeOf(row);
        return (
          <>
            {verdict !== null && (
              <ToneBadge tone={verdict.tone}>{verdict.text.replace("Ended — ", "")}</ToneBadge>
            )}
            {kind === "archived" && row.intention.archived !== null && (
              <div className="text-xs text-muted-foreground">
                {formatDay(row.intention.archived.at)} · {archivedBy(row)}
              </div>
            )}
          </>
        );
      },
    },
    {
      key: "act",
      header: "",
      track: "max-content",
      cell: (row) => {
        const action = actionOf(row);
        return action === null ? null : <ActionBar actions={[action]} />;
      },
    },
  ];
}
