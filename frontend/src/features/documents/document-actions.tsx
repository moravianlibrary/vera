// The acts on a document's record in its pane (docs/demos/shared/page-documents.js actionsOf):
// More ▾ holds Relink catalog record, Reclassify and Set where it is available, each a form
// dialog (component-interfaces.md §6.4) over its own endpoint; Relink and Reclassify are shared with
// Validations (components/iteration-dialogs.tsx). Each is offered only where the
// caller's grant reaches the current iteration's category and its state allows it; the server
// decides again (view-rules.md §5.1).
// TODO(rrandiak): Ask for this too and Withdraw beside the menu; Edit descriptive metadata,
// Overrule restriction, Cancel and Resume in it; labels move to i18n.

import { useId, useState } from "react";
import { z } from "zod";
import type { Publication } from "@/api/iterations";
import { publishIteration } from "@/api/iterations";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import { Field } from "@/components/classification-fields";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { FieldError, ReclassifyDialog, RelinkDialog } from "@/components/iteration-dialogs";
import { Input } from "@/components/ui/input";
import type { DocumentRecord } from "@/domain/documents";
import { currentIterationOf } from "@/domain/documents";
import type { Iteration, Session } from "@/domain/entities";
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
        invalidates={iterationInvalidations}
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
        invalidates={iterationInvalidations}
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
