// Kind B (component-interfaces.md §6.3): an action that is said to someone. What every reader of
// the record is told, required whenever one can see it (view-rules.md §5.4), and an internal
// note only staff read, as the two texts of one reason. Fields a particular action needs (the
// rule, the defects, the cause) come before the texts, and a line says whom it reaches.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import { useId, useState } from "react";
import { Field } from "@/components/classification-fields";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult, Refusal } from "@/hooks/use-action-mutation";

export interface ReasonText {
  label: string;
  // Who reads it: "all 3 askers read this", "staff only".
  hint: string;
  isRequired: boolean;
  placeholder?: string;
  // What it says until it is typed in, following the fields above it: Deny's text follows the
  // defects picked (page-validation.js).
  suggestion?: string;
}

export interface ReasonTexts {
  publicText: string;
  internalNote: string;
}

interface ReasonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  // Absent where nobody outside staff reads the result (pausing a schedule).
  publicText?: ReasonText;
  internalNote?: ReasonText;
  fields?: ReactNode;
  // "3 askers will read this".
  reach?: ReactNode;
  confirmLabel: string;
  isDestructive: boolean;
  // Trimmed; an absent or empty text is "".
  onConfirm: (texts: ReasonTexts) => Promise<ActionResult<unknown>>;
}

export function ReasonDialog({
  isOpen,
  onClose,
  title,
  description,
  publicText,
  internalNote,
  fields,
  reach,
  confirmLabel,
  isDestructive,
  onConfirm,
}: ReasonDialogProps) {
  const id = useId();
  const [typed, setTyped] = useState<Partial<ReasonTexts>>({});
  const texts: ReasonTexts = {
    publicText: typed.publicText ?? publicText?.suggestion ?? "",
    internalNote: typed.internalNote ?? internalNote?.suggestion ?? "",
  };
  const [isPending, setIsPending] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const trimmed = { publicText: texts.publicText.trim(), internalNote: texts.internalNote.trim() };
  const isMissing =
    (publicText?.isRequired === true && trimmed.publicText === "") ||
    (internalNote?.isRequired === true && trimmed.internalNote === "");

  const close = () => {
    setTyped({});
    setRefusal(null);
    onClose();
  };

  const confirm = async () => {
    setIsPending(true);
    const result = await onConfirm(trimmed);
    setIsPending(false);
    if (result.isDone) {
      close();
      return;
    }

    setRefusal(result.refusal);
  };

  const textField = (key: keyof ReasonTexts, text: ReasonText) => (
    <Field id={`${id}-${key}`} label={text.label} hint={text.hint}>
      <Textarea
        id={`${id}-${key}`}
        rows={3}
        value={texts[key]}
        placeholder={text.placeholder}
        required={text.isRequired}
        onChange={(event) => setTyped((current) => ({ ...current, [key]: event.target.value }))}
      />
    </Field>
  );

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={close}
      title={title}
      description={description}
      isDirty={(typed.publicText ?? "").trim() !== "" || (typed.internalNote ?? "").trim() !== ""}
      refusal={refusal}
      primary={{
        label: confirmLabel,
        isDestructive,
        isPending,
        isDisabled: isMissing,
        onSelect: () => void confirm(),
      }}
    >
      <div className="grid gap-4">
        {fields}
        {publicText !== undefined && textField("publicText", publicText)}
        {internalNote !== undefined && textField("internalNote", internalNote)}
        {reach !== undefined && <p className="text-xs text-muted-foreground">{reach}</p>}
      </div>
    </DialogShell>
  );
}
