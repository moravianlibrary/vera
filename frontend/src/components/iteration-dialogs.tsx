// The form dialogs that change an iteration from more than one pane (component-interfaces.md
// §6.4): Relink catalog record (Documents' More ▾, and the fix for a missing record in
// Validations) and Reclassify (More ▾ in both, flows.md V13). Each runs its own endpoint, says a
// refusal in the dialog and refetches what the caller names, since each view shows the change in
// its own lists.
// TODO(rrandiak): labels move to i18n.

import type { QueryKey } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useId } from "react";
import { z } from "zod";
import type {
  Reclassification,
  ReclassificationResult,
  Relink,
  RelinkResult,
} from "@/api/iterations";
import { reclassifyIteration, relinkIteration } from "@/api/iterations";
import { CategorySelect, Field, PrioritySelect } from "@/components/classification-fields";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { Input } from "@/components/ui/input";
import type { Iteration, Priority, Session } from "@/domain/entities";
import { prioritySchema } from "@/domain/entities";
import { scopeOfIteration } from "@/domain/iterations";
import { can } from "@/domain/permissions";
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

// ---------------------------------------------------------------- relink

const relinkFormSchema = z.object({
  catalogId: z.string().trim().min(1, "Enter the catalog ID"),
  unit: z.string().trim(),
});
export type RelinkForm = z.infer<typeof relinkFormSchema>;

export function RelinkDialog({
  isOpen,
  onClose,
  title,
  iteration,
  invalidates,
  onDone,
  current,
}: IterationDialogProps<RelinkResult> & { current: RelinkForm }) {
  const id = useId();
  const relink = useActionMutation({
    call: (change: Relink) => relinkIteration(iteration.id, change),
    invalidates,
    refusalTexts: {
      409: "Another document in VERA is already that record.",
      422: "The catalog does not know that record, or it needs one of its volumes or issues.",
    },
  });

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Relink — ${title}`}
      description="Link the document to another catalog record."
      schema={relinkFormSchema}
      defaultValues={current}
      submitLabel="Relink"
      onSubmit={async ({ catalogId, unit }) => {
        const result = await relink.run({ catalogId, unit: unit === "" ? null : unit });
        if (result.isDone) {
          onDone?.(result.value);
        }

        return result;
      }}
      render={(form) => (
        <>
          <Field id={`${id}-catalog`} label="Catalog ID" hint="the record in the catalog">
            <Input
              id={`${id}-catalog`}
              className="font-mono"
              placeholder="e.g. MZK01-001502234"
              {...form.register("catalogId")}
            />
          </Field>
          <FieldError message={form.formState.errors.catalogId?.message} />
          <Field id={`${id}-unit`} label="Volume or issue" hint="for a record of several">
            <Input id={`${id}-unit`} placeholder="e.g. roč. 12" {...form.register("unit")} />
          </Field>
          <p className="text-xs text-muted-foreground">
            The document stays what it is in VERA, with its asks and its history; the history keeps
            the record it was linked to. The checks run again on the new record.
          </p>
        </>
      )}
    />
  );
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
  const { data: categories = [] } = useCategoriesQuery();
  const reclassify = useActionMutation({
    call: (change: Reclassification) => reclassifyIteration(iteration.id, change),
    invalidates,
    refusalTexts: {
      403: "You may no longer reclassify it.",
      409: "It has been scanned meanwhile; its category and priority stay.",
      422: "Choose a category with no subcategories.",
    },
  });
  const schema = z
    .object({ categoryId: z.string().min(1, "Choose a category"), priority: prioritySchema })
    .refine(
      (values) =>
        values.categoryId !== iteration.categoryId || values.priority !== iteration.priority,
      { message: "Change the category or the priority", path: ["categoryId"] },
    );

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Reclassify — ${title}`}
      description="Change the category and the priority of the document's current iteration."
      schema={schema}
      defaultValues={{ categoryId: iteration.categoryId, priority: iteration.priority }}
      submitLabel="Save"
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
          : "Outside your custody, it is handed over: it leaves your queues for whoever holds " +
            "that category, and you cannot move it back."
      }
      render={(form) => (
        <>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <Field id={`${id}-category`} label="Category">
              <CategorySelect
                id={`${id}-category`}
                value={form.watch("categoryId")}
                onChange={(categoryId) =>
                  form.setValue("categoryId", categoryId, { shouldDirty: true })
                }
              />
            </Field>
            <Field id={`${id}-priority`} label="Priority">
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
          <p className="text-xs text-muted-foreground">The history records the change.</p>
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
