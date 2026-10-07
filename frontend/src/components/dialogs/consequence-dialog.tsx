// Kind A (component-interfaces.md §6.2): "Delete X?" and what happens if you do, as the server's
// dry run counts it, never as the client works it out. No reason is asked for.
// TODO(rrandiak): labels move to i18n.

import { useState } from "react";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import type { ActionResult, Refusal } from "@/hooks/use-action-mutation";

export interface Consequence {
  // "214 documents return to the pool as Ready".
  text: string;
  tone?: "plain" | "amber" | "red";
}

const toneClasses = {
  plain: "",
  amber: "text-tone-amber-foreground",
  red: "text-tone-red-foreground",
} as const;

interface ConsequenceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  // From the server's dry run; undefined while it answers.
  consequences: readonly Consequence[] | undefined;
  // "Delete list".
  confirmLabel: string;
  // Where "Cancel" would read as the act itself: "Keep running".
  cancelLabel?: string;
  isDestructive: boolean;
  onConfirm: () => Promise<ActionResult<unknown>>;
}

export function ConsequenceDialog({
  isOpen,
  onClose,
  title,
  description,
  consequences,
  confirmLabel,
  cancelLabel,
  isDestructive,
  onConfirm,
}: ConsequenceDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  const confirm = async () => {
    setIsPending(true);
    const result = await onConfirm();
    setIsPending(false);
    if (result.isDone) {
      onClose();
      return;
    }

    setRefusal(result.refusal);
  };

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      refusal={refusal}
      cancelLabel={cancelLabel}
      primary={{
        label: confirmLabel,
        isDestructive,
        isPending,
        isDisabled: consequences === undefined,
        onSelect: () => void confirm(),
      }}
    >
      {consequences === undefined ? (
        <p className="text-muted-foreground">Working out what this changes…</p>
      ) : (
        <ul className="grid list-disc gap-1.5 pl-5">
          {consequences.map((consequence) => (
            <li key={consequence.text} className={toneClasses[consequence.tone ?? "plain"]}>
              {consequence.text}
            </li>
          ))}
        </ul>
      )}
    </DialogShell>
  );
}
