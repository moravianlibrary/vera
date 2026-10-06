// The acts on a document's record in its pane (docs/demos/shared/page-documents.js actionsOf):
// More ▾ holds Relink catalog record, Reclassify and Set where it is available, each a form
// dialog (component-interfaces.md §6.4) over its own endpoint. Each is offered only where the
// caller's grant reaches the current iteration's category and its state allows it; the server
// decides again (view-rules.md §5.1).
// TODO(rrandiak): Ask for this too and Withdraw beside the menu; Edit descriptive metadata,
// Overrule restriction, Cancel and Resume in it; labels move to i18n.

import type { ReactNode } from "react";
import { useId, useState } from "react";
import { z } from "zod";
import type { Publication, Reclassification, Relink } from "@/api/iterations";
import { publishIteration, reclassifyIteration, relinkIteration } from "@/api/iterations";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import { CategorySelect, Field, PrioritySelect } from "@/components/classification-fields";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { Input } from "@/components/ui/input";
import type { DocumentRecord } from "@/domain/documents";
import { currentIterationOf } from "@/domain/documents";
import type { Iteration, Priority, Session } from "@/domain/entities";
import { prioritySchema } from "@/domain/entities";
import { isPublishable, isReclassifiable, scopeOfIteration } from "@/domain/iterations";
import { can } from "@/domain/permissions";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useCategoriesQuery } from "@/hooks/use-reference-query";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";

// A change to an iteration shows in the list, the record and what each watchlist counts.
const iterationInvalidations = [documentsQueryKey, watchlistsQueryKey];

type OpenDialog = "relink" | "reclassify" | "publish" | null;

interface DocumentActionsProps {
  record: DocumentRecord;
  session: Session;
  className?: string;
}

export function DocumentActions({ record, session, className }: DocumentActionsProps) {
  const { data: categories = [] } = useCategoriesQuery();
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const iteration = currentIterationOf(record);
  if (iteration === null) {
    return null;
  }

  const scope = scopeOfIteration(categories, iteration.categoryId);
  const mayDo = (permission: Parameters<typeof can>[1]) => can(session, permission, scope);
  const open = (dialog: Exclude<OpenDialog, null>) => () => setOpenDialog(dialog);
  const close = () => setOpenDialog(null);
  const { title } = record.document;

  const actions: ViewAction[] = [];
  if (mayDo("iteration.relink")) {
    actions.push({
      id: "relink",
      label: "Relink catalog record…",
      isInMenu: true,
      onSelect: open("relink"),
    });
  }

  if (mayDo("iteration.classify") && isReclassifiable(iteration)) {
    actions.push({
      id: "reclassify",
      label: "Reclassify — category, priority…",
      isInMenu: true,
      onSelect: open("reclassify"),
    });
  }

  if (mayDo("iteration.publish") && isPublishable(iteration)) {
    actions.push({
      id: "publish",
      label:
        iteration.publishedLink === null
          ? "Set where it is available…"
          : "Change where it is available…",
      isInMenu: true,
      onSelect: open("publish"),
    });
  }

  return (
    <>
      <ActionBar actions={actions} menuLabel="More" className={className} />

      <RelinkDialog
        key={`relink-${record.document.id}-${record.document.catalogId}-${record.document.unit?.value}`}
        isOpen={openDialog === "relink"}
        onClose={close}
        title={title}
        iteration={iteration}
        current={{
          catalogId: record.document.catalogId,
          unit: record.document.unit?.value ?? "",
        }}
      />
      <ReclassifyDialog
        key={`reclassify-${iteration.id}-${iteration.categoryId}-${iteration.priority}`}
        isOpen={openDialog === "reclassify"}
        onClose={close}
        title={title}
        iteration={iteration}
        session={session}
      />
      <PublishDialog
        key={`publish-${iteration.id}-${iteration.publishedLink}`}
        isOpen={openDialog === "publish"}
        onClose={close}
        title={title}
        iteration={iteration}
      />
    </>
  );
}

interface ActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // The document's title, which the dialog acts on.
  title: string;
  iteration: Iteration;
}

// ---------------------------------------------------------------- relink

const relinkFormSchema = z.object({
  catalogId: z.string().trim().min(1, "Enter the catalog ID"),
  unit: z.string().trim(),
});
type RelinkForm = z.infer<typeof relinkFormSchema>;

function RelinkDialog({
  isOpen,
  onClose,
  title,
  iteration,
  current,
}: ActionDialogProps & { current: RelinkForm }) {
  const id = useId();
  const relink = useActionMutation({
    call: (change: Relink) => relinkIteration(iteration.id, change),
    invalidates: iterationInvalidations,
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
      onSubmit={({ catalogId, unit }) => relink.run({ catalogId, unit: unit === "" ? null : unit })}
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
            the record it was linked to.
          </p>
        </>
      )}
    />
  );
}

// ---------------------------------------------------------------- reclassify

function ReclassifyDialog({
  isOpen,
  onClose,
  title,
  iteration,
  session,
}: ActionDialogProps & { session: Session }) {
  const id = useId();
  const { data: categories = [] } = useCategoriesQuery();
  const reclassify = useActionMutation({
    call: (change: Reclassification) => reclassifyIteration(iteration.id, change),
    invalidates: iterationInvalidations,
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
      onSubmit={(values) => reclassify.run(values)}
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

// ---------------------------------------------------------------- publish

const publishFormSchema = z.object({
  link: z.url({ protocol: /^https?$/, error: "Enter the web address where the scan opens" }),
});
type PublishForm = z.infer<typeof publishFormSchema>;

function PublishDialog({ isOpen, onClose, title, iteration }: ActionDialogProps) {
  const id = useId();
  const publish = useActionMutation({
    call: (publication: Publication) => publishIteration(iteration.id, publication),
    invalidates: iterationInvalidations,
    refusalTexts: {
      409: "It is not digitized yet.",
      422: "It is already available there, or the address is not a web address.",
    },
  });
  const isPublished = iteration.publishedLink !== null;
  const defaultValues: PublishForm = { link: iteration.publishedLink ?? "" };

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Where it is available — ${title}`}
      description="Set the link where a reader opens the scan."
      schema={publishFormSchema}
      defaultValues={defaultValues}
      submitLabel="Save"
      onSubmit={(values) => publish.run(values)}
      render={(form) => (
        <>
          <Field id={`${id}-link`} label="Link" hint="where a reader opens the scan">
            <Input
              id={`${id}-link`}
              type="url"
              placeholder="https://…"
              {...form.register("link")}
            />
          </Field>
          <FieldError message={form.formState.errors.link?.message} />
          <p className="text-xs text-muted-foreground">
            {isPublished ? (
              "It stays Published; the history keeps the old link."
            ) : (
              <>
                Saving makes it <b>Published</b>: everyone who asked is told, with the link.
              </>
            )}
          </p>
        </>
      )}
    />
  );
}

// ---------------------------------------------------------------- shared

function FieldError({ message }: { message: ReactNode | undefined }) {
  if (message === undefined) {
    return null;
  }

  return (
    <p role="alert" className="-mt-2 text-xs text-destructive">
      {message}
    </p>
  );
}
