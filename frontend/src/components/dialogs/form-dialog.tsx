// Kind C (component-interfaces.md §6.4): an editor of a few fields. Zod checks the values,
// React Hook Form holds them; a warning computed from the values sits above the footer, and a
// refusal naming a field shows under it. Typed changes make closing ask first.

import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode } from "react";
import { useState } from "react";
import type { DefaultValues, FieldValues, Path, UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import type { DialogSecondaryAction } from "@/components/dialogs/dialog-shell";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import type { ActionResult, Refusal } from "@/hooks/use-action-mutation";

// A refusal the server tied to one of the fields.
export interface FieldRefusal<Values> {
  field: Path<Values>;
  message: string;
}

interface FormDialogProps<Values extends FieldValues> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  schema: z.ZodType<Values, Values>;
  defaultValues: DefaultValues<Values>;
  render: (form: UseFormReturn<Values>) => ReactNode;
  // "An approved project: dates still change".
  warningOf?: (values: Values) => ReactNode;
  submitLabel: string;
  onSubmit: (values: Values) => Promise<ActionResult<unknown>>;
  // Which field a refusal is about, where the action can tell.
  fieldOf?: (refusal: Refusal) => Path<Values> | null;
  // "Delete…", apart from saving.
  secondary?: DialogSecondaryAction;
}

export function FormDialog<Values extends FieldValues>({
  isOpen,
  onClose,
  title,
  description,
  schema,
  defaultValues,
  render,
  warningOf,
  submitLabel,
  onSubmit,
  fieldOf,
  secondary,
}: FormDialogProps<Values>) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues });
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const warning = warningOf?.(form.watch());

  const close = () => {
    form.reset(defaultValues);
    setRefusal(null);
    onClose();
  };

  const submit = form.handleSubmit(async (values) => {
    const result = await onSubmit(values);
    if (result.isDone) {
      close();
      return;
    }

    const field = fieldOf?.(result.refusal) ?? null;
    if (field === null) {
      setRefusal(result.refusal);
      return;
    }

    form.setError(field, { message: result.refusal.message });
  });

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={close}
      title={title}
      description={description}
      isDirty={form.formState.isDirty}
      refusal={refusal}
      secondary={secondary}
      primary={{
        label: submitLabel,
        isPending: form.formState.isSubmitting,
        onSelect: () => void submit(),
      }}
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {render(form)}
        {warning !== undefined && warning !== null && (
          <p className="text-xs text-tone-amber-foreground">{warning}</p>
        )}
      </form>
    </DialogShell>
  );
}
