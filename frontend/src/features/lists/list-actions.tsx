// What is done to a digitization list from its pane (page-lists.js browse; flows.md L12–L16).
// *Mark Done…* while it runs, primary once it has ended: every open member moves to Digitized,
// as the server's dry run counts it first. *Start now…* on a Planned list moves its start date to
// today (ACT-list-start, LC-LIST-start-now). *Delete…* in More ▾, never on a Done list: no reason,
// and the dialog says what happens to each member. Per item, while the list is not Done and the
// item is still open: *Could not be digitized…* with a message, while the list runs; *Cancel…*
// with a reason, which takes it off the list; and taking it off in the editor.

import { useQuery } from "@tanstack/react-query";
import type { DeletionDryRun, ListDetail, ListItem, MarkDoneDryRun } from "@vera/contract/lists";
import type { Session } from "@vera/domain/entities";
import { isCancellable, scopeOfIteration } from "@vera/domain/iterations";
import { isScanned } from "@vera/domain/lists";
import { can, hasPermission } from "@vera/domain/permissions";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { i18n } from "@/i18n";
import { formatCalendarDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";

const listRefusalTextsOf = (t: (key: string) => string) => ({
  "list.done": t("listActions.refusalDone"),
  "list.not_started": t("listActions.refusalNotStarted"),
  "list.already_started": t("listActions.refusalStarted"),
});

type OpenDialog = "start" | "done" | "delete" | null;

interface ListActionsOptions {
  detail: ListDetail;
  session: Session;
  onDeleted: () => void;
}

export function useListActions({ detail, session, onDeleted }: ListActionsOptions) {
  const { t } = useTranslation("lists");
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
    refusalTexts: listRefusalTextsOf(t),
  });
  const start = useActionMutation({
    call: startList,
    invalidates: listInvalidations,
    refusalTexts: listRefusalTextsOf(t),
  });
  const remove = useActionMutation({
    call: deleteList,
    invalidates: listInvalidations,
    refusalTexts: listRefusalTextsOf(t),
  });

  // A Done list is history: nothing on it or about it changes (flows.md L16).
  const isOpen = row.state !== "Done";
  const markDoneAction: ViewAction | null =
    hasPermission(session, "list.edit") && row.state === "InProgress"
      ? {
          id: "done",
          label: t("listActions.markDone"),
          isPrimary: row.isOverdue,
          onSelect: () => setOpenDialog("done"),
        }
      : null;
  const editAction: ViewAction | null =
    hasPermission(session, "list.edit") && isOpen
      ? {
          id: "edit",
          label: t("listActions.edit"),
          isPrimary: !row.isOverdue,
          href: `/lists/${encodeURIComponent(list.id)}/edit`,
        }
      : null;
  // The primary first, so it is the one a phone keeps as a button.
  const ordered = row.isOverdue ? [markDoneAction, editAction] : [editAction, markDoneAction];
  const actions = ordered.filter((action) => action !== null);

  if (hasPermission(session, "list.edit") && row.state === "Planned") {
    actions.push({
      id: "start",
      label: t("listActions.start"),
      onSelect: () => setOpenDialog("start"),
    });
  }

  if (hasPermission(session, "list.delete") && isOpen) {
    actions.push({
      id: "delete",
      label: t("listActions.delete"),
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
        title={t("listActions.startTitle", { name: list.name })}
        description={t("listActions.startDescription", { date: formatCalendarDay(list.startsOn) })}
        consequences={[
          { text: t("listActions.startConsequence") },
          {
            text: t("listActions.intentionConsequence"),
          },
          { text: t("listActions.historyConsequence") },
        ]}
        confirmLabel={t("listActions.start")}
        isDestructive={false}
        onConfirm={() => start.run(list.id)}
      />
      <ConsequenceDialog
        isOpen={openDialog === "done"}
        onClose={() => setOpenDialog(null)}
        title={t("listActions.doneTitle", { name: list.name })}
        description={t("listActions.doneDescription")}
        consequences={
          doneDryRun.data === undefined ? undefined : doneConsequencesOf(doneDryRun.data)
        }
        confirmLabel={t("listActions.markDone")}
        isDestructive={false}
        onConfirm={() => done.run(list.id)}
      />
      <ConsequenceDialog
        isOpen={openDialog === "delete"}
        onClose={() => setOpenDialog(null)}
        title={t("listActions.deleteTitle", { name: list.name })}
        description={t("listActions.deleteDescription")}
        consequences={
          deletionDryRun.data === undefined
            ? undefined
            : deletionConsequencesOf(deletionDryRun.data, list.id)
        }
        confirmLabel={t("listActions.deleteList")}
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
  const t = (key: string, options?: Record<string, unknown>) => i18n.t(`lists:${key}`, options);
  const { toDigitized, alreadyScannedCount, notDigitizableCount, blocked } = dryRun;
  const consequences: (Consequence | null)[] = [
    {
      text: t("listActions.toDigitized", {
        count: toDigitized.itemCount,
        pages: formatCount(toDigitized.pages),
      }),
    },
    alreadyScannedCount > 0
      ? {
          text: t("listActions.alreadyScanned", { count: alreadyScannedCount }),
        }
      : null,
    notDigitizableCount > 0
      ? {
          text: t("listActions.notDigitizable", { count: notDigitizableCount }),
        }
      : null,
    blocked.length > 0
      ? {
          text: t("listActions.blocked", {
            count: blocked.length,
            names: blocked.map((item) => item.title).join(", "),
          }),
          tone: "amber",
        }
      : null,
    {
      text: t("listActions.doneFinal"),
    },
  ];
  return consequences.filter((consequence) => consequence !== null);
}

function deletionConsequencesOf(dryRun: DeletionDryRun, listId: string): Consequence[] {
  const t = (key: string, options?: Record<string, unknown>) => i18n.t(`lists:${key}`, options);
  const { toReady, toEnqueuedCount, scannedCount, heldCount } = dryRun;
  const consequences: (Consequence | null)[] = [
    {
      text: t("listActions.toReady", {
        count: toReady.itemCount,
        pages: formatCount(toReady.pages),
      }),
    },
    toEnqueuedCount > 0
      ? {
          text: t("listActions.toEnqueued", { count: toEnqueuedCount }),
          tone: "amber",
        }
      : null,
    scannedCount > 0
      ? {
          text: t("listActions.scannedStatus", { count: scannedCount }),
        }
      : null,
    heldCount > 0
      ? {
          text: t("listActions.held", { count: heldCount }),
        }
      : null,
    {
      text: t("listActions.deletedHistory", { id: listId }),
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
  const { t } = useTranslation("lists");
  const { data: categories = [] } = useCategoriesQuery();
  const [openDialog, setOpenDialog] = useState<OpenItemDialog>(null);
  const { row } = detail;
  const { list } = row;
  const { iteration, document } = item;
  const notDigitizable = useActionMutation({
    call: (message: string) => markNotDigitizable(list.id, iteration.id, { message }),
    invalidates: listInvalidations,
    refusalTexts: {
      ...listRefusalTextsOf(t),
      "iteration.stopped": t("listActions.iterationStopped"),
    },
  });
  const cancel = useActionMutation({
    call: (texts: { publicText: string; internalText: string | null }) =>
      cancelIteration(iteration.id, texts),
    invalidates: listInvalidations,
    refusalTexts: { 409: t("listActions.alreadyHeld") },
  });

  if (row.state === "Done" || isScanned(iteration) || iteration.cancellation !== null) {
    return null;
  }

  const actions: ViewAction[] = [];
  if (hasPermission(session, "list.edit") && row.state === "InProgress") {
    actions.push({
      id: "notDigitizable",
      label: t("listActions.notDigitizedAction"),
      isInMenu: true,
      onSelect: () => setOpenDialog("notDigitizable"),
    });
  }

  const scope = scopeOfIteration(categories, iteration.categoryId);
  if (can(session, "iteration.cancel", scope) && isCancellable(iteration)) {
    actions.push({
      id: "cancel",
      label: t("listActions.cancel"),
      isInMenu: true,
      isDestructive: true,
      onSelect: () => setOpenDialog("cancel"),
    });
  }

  if (hasPermission(session, "list.edit")) {
    actions.push({
      id: "takeOff",
      label: t("listActions.takeOff"),
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
        title={t("listActions.notDigitizedTitle", { title: document.title })}
        description={t("listActions.notDigitizedDescription")}
        publicText={{
          label: t("listActions.message"),
          hint: t("listActions.requiredEveryAsker"),
          isRequired: true,
          placeholder: t("listActions.notDigitizedPlaceholder"),
        }}
        reach={t("listActions.notDigitizedReach", { name: list.name })}
        confirmLabel={t("listActions.markIt")}
        isDestructive
        onConfirm={({ publicText }) => notDigitizable.run(publicText)}
      />
      <ReasonDialog
        isOpen={openDialog === "cancel"}
        onClose={() => setOpenDialog(null)}
        title={t("listActions.cancelTitle", { title: document.title })}
        description={t("listActions.cancelDescription")}
        publicText={{
          label: t("listActions.reason"),
          hint: t("listActions.requiredEveryAsker"),
          isRequired: true,
          placeholder: t("listActions.cancelPlaceholder"),
        }}
        internalNote={{
          label: t("listActions.internalNote"),
          hint: t("listActions.optionalStaff"),
          isRequired: false,
        }}
        reach={t("listActions.cancelReach")}
        confirmLabel={t("listActions.cancelIt")}
        isDestructive
        onConfirm={({ publicText, internalNote }) =>
          cancel.run({ publicText, internalText: internalNote || null })
        }
      />
    </>
  );
}
