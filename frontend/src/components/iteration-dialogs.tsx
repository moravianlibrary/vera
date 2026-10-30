// The form dialogs that change an iteration from more than one pane (component-interfaces.md
// §6.4): Reclassify (More ▾ in Documents and Validations, flows.md V13). Each runs its own endpoint, says a
// refusal in the dialog and refetches what the caller names, since each view shows the change in
// its own lists.

import type { QueryKey } from "@tanstack/react-query";
import type { Reclassification, ReclassificationResult } from "@vera/contract/iterations";
import type { Iteration, Priority, Session } from "@vera/domain/entities";
import { prioritySchema } from "@vera/domain/entities";
import { scopeOfIteration } from "@vera/domain/iterations";
import { can } from "@vera/domain/permissions";
import type { ReactNode } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { reclassifyIteration } from "@/api/iterations";
import { CategorySelect, Field, PrioritySelect } from "@/components/classification-fields";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useCategoriesQuery } from "@/hooks/use-reference-query";

interface IterationDialogProps<Result> {
  isOpen: boolean;
  onClose: () => void;
  // The document's title, which the dialog acts on.
  title: string;
  iteration: Iteration;
  // Every query the change shows in.
  invalidates: readonly QueryKey[];
  // Once it is done, before the dialog closes.
  onDone?: (result: Result) => void;
}

// ---------------------------------------------------------------- reclassify

export function ReclassifyDialog({
  isOpen,
  onClose,
  title,
  iteration,
  invalidates,
  onDone,
  session,
}: IterationDialogProps<ReclassificationResult> & { session: Session }) {
  const id = useId();
  const { t } = useTranslation("common");
  const { data: categories = [] } = useCategoriesQuery();
  const reclassify = useActionMutation({
    call: (change: Reclassification) => reclassifyIteration(iteration.id, change),
    invalidates,
    refusalTexts: {
      403: t("reclassify.forbidden"),
      409: t("reclassify.scannedMeanwhile"),
      422: t("reclassify.leafCategory"),
    },
  });
  const schema = z
    .object({
      categoryId: z.string().min(1, t("classification.chooseCategory")),
      priority: prioritySchema,
    })
    .refine(
      (values) =>
        values.categoryId !== iteration.categoryId || values.priority !== iteration.priority,
      { message: t("reclassify.changeCategoryOrPriority"), path: ["categoryId"] },
    );

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("reclassify.title", { title })}
      description={t("reclassify.description")}
      schema={schema}
      defaultValues={{ categoryId: iteration.categoryId, priority: iteration.priority }}
      submitLabel={t("dialog.save")}
      onSubmit={async (values) => {
        const result = await reclassify.run(values);
        if (result.isDone) {
          onDone?.(result.value);
        }

        return result;
      }}
      warningOf={({ categoryId }) =>
        can(session, "iteration.classify", scopeOfIteration(categories, categoryId))
          ? null
          : t("reclassify.handedOver")
      }
      render={(form) => (
        <>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <Field id={`${id}-category`} label={t("mixSet.category")}>
              <CategorySelect
                id={`${id}-category`}
                value={form.watch("categoryId")}
                onChange={(categoryId) =>
                  form.setValue("categoryId", categoryId, { shouldDirty: true })
                }
              />
            </Field>
            <Field id={`${id}-priority`} label={t("reclassify.priority")}>
              <PrioritySelect
                id={`${id}-priority`}
                value={form.watch("priority")}
                onChange={(priority: Priority) =>
                  form.setValue("priority", priority, { shouldDirty: true })
                }
              />
            </Field>
          </div>
          <FieldError message={form.formState.errors.categoryId?.message} />
          <p className="text-xs text-muted-foreground">{t("reclassify.historyNote")}</p>
        </>
      )}
    />
  );
}

// ---------------------------------------------------------------- shared

export function FieldError({ message }: { message: ReactNode | undefined }) {
  if (message === undefined) {
    return null;
  }

  return (
    <p role="alert" className="-mt-2 text-xs text-destructive">
      {message}
    </p>
  );
}
