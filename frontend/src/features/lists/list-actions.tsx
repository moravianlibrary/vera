// What is done to a digitization list from its pane (page-lists.js browse; flows.md L12–L16).
// *Mark Done…* while it runs, primary once it has ended: every open member moves to Digitized,
// as the server's dry run counts it first. *Start now…* on a Planned list moves its start date to
// today (ACT-list-start, LC-LIST-start-now). *Delete…* in More ▾, never on a Done list: no reason,
// and the dialog says what happens to each member. Per item, while the list is not Done and the
// item is still open: *Could not be digitized…* with a message, while the list runs; *Cancel…*
// with a reason, which takes it off the list; and taking it off in the editor.
// TODO(rrandiak): labels move to i18n.

import { useQuery } from "@tanstack/react-query";
import type { DeletionDryRun, ListDetail, ListItem, MarkDoneDryRun } from "@vera/contract/lists";
import type { Session } from "@vera/domain/entities";
import { isCancellable, scopeOfIteration } from "@vera/domain/iterations";
import { isScanned } from "@vera/domain/lists";
import { can, hasPermission } from "@vera/domain/permissions";
import { useState } from "react";
import { cancelIteration } from "@/api/iterations";
import {
  deleteList,
  markDone,
  markNotDigitizable,
  previewDeletion,
  previewMarkDone,
  startList,
} from "@/api/lists";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import type { Consequence } from "@/components/dialogs/consequence-dialog";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import { ReasonDialog } from "@/components/dialogs/reason-dialog";
import { listInvalidations, listsQueryKey } from "@/features/lists/use-lists-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useCategoriesQuery } from "@/hooks/use-reference-query";
import { formatCalendarDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";

const listRefusalTexts = {
  "list.done": "This list was marked Done meanwhile; it no longer changes.",
  "list.not_started": "It has not started yet: nothing on it is being scanned.",
  "list.already_started": "It has started meanwhile.",
} as const;

type OpenDialog = "start" | "done" | "delete" | null;

interface ListActionsOptions {
  detail: ListDetail;
  session: Session;
  onDeleted: () => void;
}

export function useListActions({ detail, session, onDeleted }: ListActionsOptions) {
  const { row } = detail;
  const { list } = row;
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const doneDryRun = useQuery({
    queryKey: [...listsQueryKey, "dryRun", "done", list.id],
    queryFn: () => previewMarkDone(list.id),
    enabled: openDialog === "done",
    gcTime: 0,
  });
  const deletionDryRun = useQuery({
    queryKey: [...listsQueryKey, "dryRun", "deletion", list.id],
    queryFn: () => previewDeletion(list.id),
    enabled: openDialog === "delete",
    gcTime: 0,
  });
  const done = useActionMutation({
    call: markDone,
    invalidates: listInvalidations,
    refusalTexts: listRefusalTexts,
  });
  const start = useActionMutation({
    call: startList,
    invalidates: listInvalidations,
    refusalTexts: listRefusalTexts,
  });
  const remove = useActionMutation({
    call: deleteList,
    invalidates: listInvalidations,
    refusalTexts: listRefusalTexts,
  });

  // A Done list is history: nothing on it or about it changes (flows.md L16).
  const isOpen = row.state !== "Done";
  const markDoneAction: ViewAction | null =
    hasPermission(session, "list.edit") && row.state === "InProgress"
      ? {
          id: "done",
          label: "Mark Done…",
          isPrimary: row.isOverdue,
          onSelect: () => setOpenDialog("done"),
        }
      : null;
  const editAction: ViewAction | null =
    hasPermission(session, "list.edit") && isOpen
      ? {
          id: "edit",
          label: "Edit",
          isPrimary: !row.isOverdue,
          href: `/lists/${encodeURIComponent(list.id)}/edit`,
        }
      : null;
  // The primary first, so it is the one a phone keeps as a button.
  const ordered = row.isOverdue ? [markDoneAction, editAction] : [editAction, markDoneAction];
  const actions = ordered.filter((action) => action !== null);

  if (hasPermission(session, "list.edit") && row.state === "Planned") {
    actions.push({ id: "start", label: "Start now…", onSelect: () => setOpenDialog("start") });
  }

  if (hasPermission(session, "list.delete") && isOpen) {
    actions.push({
      id: "delete",
      label: "Delete…",
      isInMenu: true,
      isDestructive: true,
      onSelect: () => setOpenDialog("delete"),
    });
  }

  const dialogs = (
    <>
      <ConsequenceDialog
        isOpen={openDialog === "start"}
        onClose={() => setOpenDialog(null)}
        title={`Start ${list.name} now?`}
        description={`It was to start ${formatCalendarDay(list.startsOn)}; its start date becomes today.`}
        consequences={[
          { text: "It is In progress from now, and so is everything on it not held." },
          {
            text: "Intentions count a list by the day it starts, so it may count towards other ones.",
          },
          { text: "The history keeps the date it replaced." },
        ]}
        confirmLabel="Start now"
        isDestructive={false}
        onConfirm={() => start.run(list.id)}
      />
      <ConsequenceDialog
        isOpen={openDialog === "done"}
        onClose={() => setOpenDialog(null)}
        title={`Mark ${list.name} Done?`}
        description="Everything on it not marked could not be digitized moves to Digitized."
        consequences={
          doneDryRun.data === undefined ? undefined : doneConsequencesOf(doneDryRun.data)
        }
        confirmLabel="Mark Done"
        isDestructive={false}
        onConfirm={() => done.run(list.id)}
      />
      <ConsequenceDialog
        isOpen={openDialog === "delete"}
        onClose={() => setOpenDialog(null)}
        title={`Delete ${list.name}?`}
        description="What is on it returns to the pool; the list is gone."
        consequences={
          deletionDryRun.data === undefined
            ? undefined
            : deletionConsequencesOf(deletionDryRun.data, list.id)
        }
        confirmLabel="Delete list"
        isDestructive
        onConfirm={async () => {
          const result = await remove.run(list.id);
          if (result.isDone) {
            onDeleted();
          }

          return result;
        }}
      />
    </>
  );

  return { actions, dialogs };
}

function doneConsequencesOf(dryRun: MarkDoneDryRun): Consequence[] {
  const { toDigitized, alreadyScannedCount, notDigitizableCount, blocked } = dryRun;
  const consequences: (Consequence | null)[] = [
    {
      text: `${plural(toDigitized.itemCount, "item moves", "items move")} to Digitized — ${formatCount(toDigitized.pages)} pp`,
    },
    alreadyScannedCount > 0
      ? {
          text: `${alreadyScannedCount} already digitized ${alreadyScannedCount === 1 ? "stays as it is" : "stay as they are"}`,
        }
      : null,
    notDigitizableCount > 0
      ? {
          text: `${notDigitizableCount} marked could not be digitized ${notDigitizableCount === 1 ? "does not; its message stands" : "do not; their message stands"}`,
        }
      : null,
    blocked.length > 0
      ? {
          text: `${blocked.length} ${blocked.length === 1 ? "is" : "are"} blocked since listing — ${blocked.map((item) => item.title).join(", ")}. If ${blocked.length === 1 ? "it was" : "they were"} not scanned, close this and mark ${blocked.length === 1 ? "it" : "them"} could not be digitized first.`,
          tone: "amber",
        }
      : null,
    {
      text: "If something on it was not scanned, mark that item first, from the ⋯ beside it. Done is final: the list stays as history and cannot be deleted.",
    },
  ];
  return consequences.filter((consequence) => consequence !== null);
}

function deletionConsequencesOf(dryRun: DeletionDryRun, listId: string): Consequence[] {
  const { toReady, toEnqueuedCount, scannedCount, heldCount } = dryRun;
  const consequences: (Consequence | null)[] = [
    {
      text: `${plural(toReady.itemCount, "item returns", "items return")} to the pool as Ready — ${formatCount(toReady.pages)} pp`,
    },
    toEnqueuedCount > 0
      ? {
          text: `${toEnqueuedCount} blocked since listing ${toEnqueuedCount === 1 ? "goes" : "go"} back to Enqueued, Ready again when the gate clears`,
          tone: "amber",
        }
      : null,
    scannedCount > 0
      ? {
          text: `${scannedCount} already digitized ${scannedCount === 1 ? "keeps its" : "keep their"} status`,
        }
      : null,
    heldCount > 0
      ? {
          text: `${heldCount} cancelled or not digitizable ${heldCount === 1 ? "stays" : "stay"} held`,
        }
      : null,
    {
      text: `A list is deleted, not cancelled: no reason is asked. That they were listed on ${listId} stays in each one's history.`,
    },
  ];
  return consequences.filter((consequence) => consequence !== null);
}

// ---------------------------------------------------------------- per item

type OpenItemDialog = "notDigitizable" | "cancel" | null;

interface ItemActionsProps {
  item: ListItem;
  detail: ListDetail;
  session: Session;
}

// The ⋯ beside a member, with its dialogs; nothing for a member that is scanned or stopped, or on
// a Done list.
export function ItemActions({ item, detail, session }: ItemActionsProps) {
  const { data: categories = [] } = useCategoriesQuery();
  const [openDialog, setOpenDialog] = useState<OpenItemDialog>(null);
  const { row } = detail;
  const { list } = row;
  const { iteration, document } = item;
  const notDigitizable = useActionMutation({
    call: (message: string) => markNotDigitizable(list.id, iteration.id, { message }),
    invalidates: listInvalidations,
    refusalTexts: {
      ...listRefusalTexts,
      "iteration.stopped": "It was scanned or stopped meanwhile.",
    },
  });
  const cancel = useActionMutation({
    call: (texts: { publicText: string; internalText: string | null }) =>
      cancelIteration(iteration.id, texts),
    invalidates: listInvalidations,
    refusalTexts: { 409: "It is already held, or it has been scanned meanwhile." },
  });

  if (row.state === "Done" || isScanned(iteration) || iteration.cancellation !== null) {
    return null;
  }

  const actions: ViewAction[] = [];
  if (hasPermission(session, "list.edit") && row.state === "InProgress") {
    actions.push({
      id: "notDigitizable",
      label: "Could not be digitized…",
      isInMenu: true,
      onSelect: () => setOpenDialog("notDigitizable"),
    });
  }

  const scope = scopeOfIteration(categories, iteration.categoryId);
  if (can(session, "iteration.cancel", scope) && isCancellable(iteration)) {
    actions.push({
      id: "cancel",
      label: "Cancel…",
      isInMenu: true,
      isDestructive: true,
      onSelect: () => setOpenDialog("cancel"),
    });
  }

  if (hasPermission(session, "list.edit")) {
    actions.push({
      id: "takeOff",
      label: "Take it off — in the editor",
      isInMenu: true,
      href: `/lists/${encodeURIComponent(list.id)}/edit`,
    });
  }

  return (
    <>
      <ActionBar actions={actions} />
      <ReasonDialog
        isOpen={openDialog === "notDigitizable"}
        onClose={() => setOpenDialog(null)}
        title={`Could not be digitized — ${document.title}`}
        description="Mark it as not digitized, with a message every asker reads."
        publicText={{
          label: "Message",
          hint: "required; every asker reads it",
          isRequired: true,
          placeholder: "e.g. Pages too tightly bound to open safely; sent to conservation.",
        }}
        reach={`It stays on ${list.name}, marked. Marking the list Done moves every other item to Digitized; this one is not.`}
        confirmLabel="Mark it"
        isDestructive
        onConfirm={({ publicText }) => notDigitizable.run(publicText)}
      />
      <ReasonDialog
        isOpen={openDialog === "cancel"}
        onClose={() => setOpenDialog(null)}
        title={`Cancel — ${document.title}`}
        description="Hold it at the gate and take it off the list."
        publicText={{
          label: "Reason",
          hint: "required; every asker reads it",
          isRequired: true,
          placeholder: "e.g. Postponed — will be scheduled next quarter.",
        }}
        internalNote={{ label: "Internal note", hint: "optional; staff only", isRequired: false }}
        reach="Held at the gate, and taken off the list. Resuming it in Documents brings it back to the pool."
        confirmLabel="Cancel it"
        isDestructive
        onConfirm={({ publicText, internalNote }) =>
          cancel.run({ publicText, internalText: internalNote || null })
        }
      />
    </>
  );
}
