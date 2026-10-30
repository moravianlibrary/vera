// Kind D (component-interfaces.md §6.5): a set edited and saved whole. Changing one entry is
// deciding where the difference goes, so the whole set is sent and the server checks it. What the
// client can already see is wrong (over 100, nobody left to manage) holds Save back with the
// reason. Where the change reaches others, Save first shows whom, as a second step with Back;
// the instance owns whatever is chosen there. Proportions on an intention's Mix is the first
// instance; category custody and the role editor follow.

import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { StepIndicator } from "@/components/dialogs/step-indicator";
import type { ActionResult, Refusal } from "@/hooks/use-action-mutation";

// What the change reaches, said before it is saved.
export interface SetReach {
  body: ReactNode;
  submitLabel: string;
}

export interface SetEditorDialogProps<Entry> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  // Wide for a long set read in columns: the role editor's permissions.
  width?: "regular" | "wide";
  // As stored; the editor starts from them.
  entries: readonly Entry[];
  renderEntries: (
    entries: readonly Entry[],
    onChange: (next: readonly Entry[]) => void,
  ) => ReactNode;
  // Under the set: its sum, what it leaves, what it means.
  summaryOf?: (entries: readonly Entry[]) => ReactNode;
  // What the client can already refuse; null when it may be saved.
  invalidReasonOf: (entries: readonly Entry[]) => string | null;
  // Null when it reaches nobody else, and Save saves.
  reachOf?: (entries: readonly Entry[]) => SetReach | null;
  submitLabel: string;
  onSave: (entries: readonly Entry[]) => Promise<ActionResult<unknown>>;
}

export function SetEditorDialog<Entry>({
  isOpen,
  onClose,
  title,
  description,
  width,
  entries: stored,
  renderEntries,
  summaryOf,
  invalidReasonOf,
  reachOf,
  submitLabel,
  onSave,
}: SetEditorDialogProps<Entry>) {
  const { t } = useTranslation("common");
  const [entries, setEntries] = useState<readonly Entry[]>(stored);
  const [isReaching, setIsReaching] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const invalidReason = invalidReasonOf(entries);
  const reach = invalidReason === null ? (reachOf?.(entries) ?? null) : null;

  const close = () => {
    setEntries(stored);
    setIsReaching(false);
    setRefusal(null);
    onClose();
  };

  const save = async () => {
    setIsPending(true);
    const result = await onSave(entries);
    setIsPending(false);
    if (result.isDone) {
      close();
      return;
    }

    setRefusal(result.refusal);
  };

  const isOnReach = isReaching && reach !== null;
  return (
    <DialogShell
      isOpen={isOpen}
      onClose={close}
      title={title}
      description={description}
      width={width}
      isDirty={JSON.stringify(entries) !== JSON.stringify(stored)}
      refusal={refusal}
      head={
        reach === null ? undefined : (
          <StepIndicator
            steps={[t("setEditor.theSet"), t("setEditor.whoItReaches")]}
            currentIndex={isOnReach ? 1 : 0}
          />
        )
      }
      onBack={isOnReach ? () => setIsReaching(false) : undefined}
      primary={
        isOnReach
          ? { label: reach.submitLabel, isPending, onSelect: () => void save() }
          : {
              label: reach === null ? submitLabel : t("dialog.next"),
              isPending,
              isDisabled: invalidReason !== null,
              onSelect: () => (reach === null ? void save() : setIsReaching(true)),
            }
      }
    >
      {isOnReach ? (
        reach.body
      ) : (
        <div className="grid gap-3">
          {renderEntries(entries, setEntries)}
          {summaryOf?.(entries)}
          {invalidReason !== null && (
            <p className="text-xs font-medium text-tone-red-foreground">{invalidReason}</p>
          )}
        </div>
      )}
    </DialogShell>
  );
}
