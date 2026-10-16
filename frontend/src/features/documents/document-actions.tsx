// The acts on a document's record in its pane (docs/demos/shared/page-documents.js actionsOf):
// *Withdraw…* beside the menu for the caller's own ask still waiting (ACT-withdraw), the one act
// a requester has on My Documents. More ▾ holds Reclassify, Set where it is available, Overrule
// restriction (ACT-overrule), and Cancel or Resume (ACT-cancel, ACT-resume), each a dialog over
// its own endpoint; Reclassify is shared with Validations (components/iteration-dialogs.tsx). Each
// is offered only where the caller's grant reaches the current iteration's category and its state
// allows it; the server decides again (view-rules.md §5.1).
// TODO(rrandiak): Ask for this too beside the menu; labels move to i18n. No Edit descriptive
// metadata: VERA corrects no catalog data (decided 2026-10-06).

import type { CancellationRequest, Overrule, Publication } from "@vera/contract/iterations";
import type { DocumentRecord } from "@vera/domain/documents";
import { currentIterationOf, followedIterationId } from "@vera/domain/documents";
import type { Iteration, Session } from "@vera/domain/entities";
import {
  isCancellable,
  isOverrulable,
  isPublishable,
  isReclassifiable,
  isResumable,
  scopeOfIteration,
} from "@vera/domain/iterations";
import { can, hasPermission } from "@vera/domain/permissions";
import { useId, useState } from "react";
import { z } from "zod";
import {
  cancelIteration,
  overruleRestriction,
  publishIteration,
  resumeIteration,
} from "@/api/iterations";
import { withdrawAsk } from "@/api/requests";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import { Field } from "@/components/classification-fields";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { ReasonDialog } from "@/components/dialogs/reason-dialog";
import { FieldError, ReclassifyDialog } from "@/components/iteration-dialogs";
import { Input } from "@/components/ui/input";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { requestsQueryKey } from "@/features/requests/use-requests-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useCategoriesQuery } from "@/hooks/use-reference-query";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";

// A change to an iteration shows in the list, the record and what each watchlist counts.
const iterationInvalidations = [documentsQueryKey, watchlistsQueryKey];
// A withdrawn ask leaves Requests' queue too.
const withdrawalInvalidations = [documentsQueryKey, requestsQueryKey, watchlistsQueryKey];

type OpenDialog = "withdraw" | "reclassify" | "publish" | "overrule" | "cancel" | "resume" | null;

interface DocumentActionsProps {
  record: DocumentRecord;
  session: Session;
  // My Documents: the record is the caller's own ask, and only withdrawing it is offered.
  isOwn?: boolean;
  className?: string;
}

export function DocumentActions({
  record,
  session,
  isOwn = false,
  className,
}: DocumentActionsProps) {
  const { data: categories = [] } = useCategoriesQuery();
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const iteration = currentIterationOf(record);
  const open = (dialog: Exclude<OpenDialog, null>) => () => setOpenDialog(dialog);
  const close = () => setOpenDialog(null);
  const { title } = record.document;

  const actions: ViewAction[] = [];
  // ACT-withdraw: the caller's own ask, while it still waits; there is at most one (LC-REQ-check).
  const isOwnPending = record.requests.some(
    (request) => request.requesterId === session.user.id && request.decision === "Pending",
  );
  if (isOwnPending && hasPermission(session, "request.withdraw_own")) {
    actions.push({ id: "withdraw", label: "Withdraw…", onSelect: open("withdraw") });
  }

  const withdrawDialog = (
    <WithdrawDialog
      isOpen={openDialog === "withdraw"}
      onClose={close}
      title={title}
      documentId={record.document.id}
    />
  );
  if (iteration === null || isOwn) {
    return (
      <>
        <ActionBar actions={actions} menuLabel="More" className={className} />
        {withdrawDialog}
      </>
    );
  }

  const scope = scopeOfIteration(categories, iteration.categoryId);
  const mayDo = (permission: Parameters<typeof can>[1]) => can(session, permission, scope);
  const askerCount = new Set(
    record.requests
      .filter((request) => followedIterationId(request) === iteration.id)
      .map((request) => request.requesterId),
  ).size;

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

  // ACT-overrule: held at `any` only, never custody.
  if (mayDo("restriction.overrule") && isOverrulable(iteration)) {
    actions.push({
      id: "overrule",
      label: "Overrule restriction…",
      isInMenu: true,
      isDestructive: true,
      onSelect: open("overrule"),
    });
  }

  if (mayDo("iteration.resume") && isResumable(iteration)) {
    actions.push({ id: "resume", label: "Resume…", isInMenu: true, onSelect: open("resume") });
  } else if (mayDo("iteration.cancel") && isCancellable(iteration)) {
    actions.push({
      id: "cancel",
      label: "Cancel…",
      isInMenu: true,
      isDestructive: true,
      onSelect: open("cancel"),
    });
  }

  return (
    <>
      <ActionBar actions={actions} menuLabel="More" className={className} />
      {withdrawDialog}

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
      <OverruleDialog
        isOpen={openDialog === "overrule"}
        onClose={close}
        title={title}
        iteration={iteration}
      />
      <CancelDialog
        isOpen={openDialog === "cancel"}
        onClose={close}
        title={title}
        iteration={iteration}
        askerCount={askerCount}
      />
      <ResumeDialog
        isOpen={openDialog === "resume"}
        onClose={close}
        title={title}
        iteration={iteration}
      />
    </>
  );
}

// ---------------------------------------------------------------- withdraw

// Final: a withdrawn ask is history, and asking again makes a new request (LC-REQ-final).
function WithdrawDialog({
  isOpen,
  onClose,
  title,
  documentId,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  documentId: string;
}) {
  const withdraw = useActionMutation({
    call: withdrawAsk,
    invalidates: withdrawalInvalidations,
    refusalTexts: { 409: "It has been decided meanwhile; there is nothing to withdraw." },
  });
  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Withdraw your ask — ${title}?`}
      description="Nobody reviews it any more."
      consequences={[
        { text: "It shows Withdrawn; other people's asks for it stand." },
        { text: "This is final: asking again later makes a new request." },
      ]}
      confirmLabel="Withdraw"
      cancelLabel="Keep it"
      isDestructive
      onConfirm={() => withdraw.run(documentId)}
    />
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

// A web address, or a PID or a viewer's address that a Link plugin turns into the canonical link
// (PLG-kinds); the server says which it could not read.
const publishFormSchema = z.object({
  link: z.string().trim().min(1, "Enter where the scan opens"),
});
type PublishForm = z.infer<typeof publishFormSchema>;

function PublishDialog({ isOpen, onClose, title, iteration }: ActionDialogProps) {
  const id = useId();
  const publish = useActionMutation({
    call: (publication: Publication) => publishIteration(iteration.id, publication),
    invalidates: iterationInvalidations,
    refusalTexts: {
      409: "It is not digitized yet.",
      "iteration.link_unread": "That is no web address, and no Link plugin reads it as a PID.",
      422: "It is already available there.",
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
          <Field
            id={`${id}-link`}
            label="Link"
            hint="where a reader opens the scan: its address, or its PID"
          >
            <Input id={`${id}-link`} placeholder="https://… or uuid:…" {...form.register("link")} />
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

// ---------------------------------------------------------------- overrule

// Only an administrator lifts a restriction; the finding stays on the record beside the overrule
// (ACT-overrule).
function OverruleDialog({ isOpen, onClose, title, iteration }: ActionDialogProps) {
  const overrule = useActionMutation({
    call: (body: Overrule) => overruleRestriction(iteration.id, body),
    invalidates: iterationInvalidations,
    refusalTexts: { 409: "No restriction stands on it any more." },
  });
  const rule = iteration.restriction?.rule ?? "A rule";
  return (
    <ReasonDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Overrule restriction — ${title}`}
      description={`${rule} forbids digitizing it. Overruled, it no longer stops it, and the gates say where it goes next.`}
      internalNote={{
        label: "Why",
        hint: "staff only; kept beside the rule's finding",
        isRequired: true,
        placeholder: "e.g. The rights holder agreed in writing on 2 Oct.",
      }}
      confirmLabel="Overrule"
      isDestructive
      onConfirm={({ internalNote }) => overrule.run({ note: internalNote })}
    />
  );
}

// ---------------------------------------------------------------- cancel and resume

function CancelDialog({
  isOpen,
  onClose,
  title,
  iteration,
  askerCount,
}: ActionDialogProps & { askerCount: number }) {
  const cancel = useActionMutation({
    call: (cancellation: CancellationRequest) => cancelIteration(iteration.id, cancellation),
    invalidates: iterationInvalidations,
    refusalTexts: { 409: "It is already held, or it has been scanned meanwhile." },
  });
  return (
    <ReasonDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Cancel — ${title}`}
      description={
        iteration.listId === null
          ? "Hold it where it is. Resume lets it through again."
          : "Hold it where it is; it comes off its list. Resume lets it through again."
      }
      publicText={{
        label: "Reason",
        hint: askerCount <= 1 ? "the asker reads this" : `all ${askerCount} askers read this`,
        isRequired: true,
        placeholder: "e.g. Postponed — will be scheduled next quarter.",
      }}
      internalNote={{ label: "Internal note", hint: "optional; staff only", isRequired: false }}
      confirmLabel="Cancel it"
      isDestructive
      onConfirm={({ publicText, internalNote }) =>
        cancel.run({ publicText, internalText: internalNote || null })
      }
    />
  );
}

// LC-ITER-resume: back to the pool, not to its old list.
function ResumeDialog({ isOpen, onClose, title, iteration }: ActionDialogProps) {
  const resume = useActionMutation({
    call: () => resumeIteration(iteration.id),
    invalidates: iterationInvalidations,
    refusalTexts: { 409: "It is no longer held, or it has been scanned meanwhile." },
  });
  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Resume — ${title}?`}
      description="The hold is lifted."
      consequences={[
        {
          text:
            iteration.listId === null
              ? "It returns to the pool, Ready once every gate passes."
              : "It comes off its list and returns to the pool, Ready once every gate passes.",
        },
        { text: "Its askers no longer read the reason it was held." },
      ]}
      confirmLabel="Resume"
      isDestructive={false}
      onConfirm={() => resume.run(undefined)}
    />
  );
}
