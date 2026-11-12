// The acts on a document's record in its pane (docs/demos/shared/page-documents.js actionsOf):
// *Withdraw…* beside the menu for the caller's own ask still waiting (ACT-withdraw), the one act
// a requester has on My Documents. More ▾ holds Reclassify, Set where it is available, Overrule
// restriction (ACT-overrule), and Cancel or Resume (ACT-cancel, ACT-resume), each a dialog over
// its own endpoint; Reclassify is shared with Validations (components/iteration-dialogs.tsx). Each
// is offered only where the caller's grant reaches the current iteration's category and its state
// allows it; the server decides again (view-rules.md §5.1).
// TODO(rrandiak): Ask for this too beside the menu. No Edit descriptive
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
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { relinkDocument } from "@/api/documents";
import { addLink, cancelIteration, overruleRestriction, resumeIteration } from "@/api/iterations";
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
import { i18n } from "@/i18n";

// A change to an iteration shows in the list, the record and what each watchlist counts.
export const iterationInvalidations = [documentsQueryKey, watchlistsQueryKey];
// A withdrawn ask leaves Requests' queue too.
const withdrawalInvalidations = [documentsQueryKey, requestsQueryKey, watchlistsQueryKey];

type OpenDialog =
  | "withdraw"
  | "reclassify"
  | "publish"
  | "overrule"
  | "cancel"
  | "resume"
  | "relink"
  | null;

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
  // ACT-relink: the server checks the category grant again when the act runs.
  useTranslation("documents");
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
    actions.push({
      id: "withdraw",
      label: i18n.t("actions.withdraw", { ns: "documents" }),
      onSelect: open("withdraw"),
    });
  }

  const withdrawDialog = (
    <WithdrawDialog
      isOpen={openDialog === "withdraw"}
      onClose={close}
      title={title}
      documentId={record.document.id}
    />
  );
  const mayRelink =
    record.document.catalogState !== null &&
    (iteration === null
      ? hasPermission(session, "iteration.recheck")
      : can(session, "iteration.recheck", scopeOfIteration(categories, iteration.categoryId)));
  if (mayRelink) {
    actions.push({
      id: "relink",
      label: i18n.t("actions.relink", { ns: "documents" }),
      onSelect: open("relink"),
    });
  }
  const relinkDialog = (
    <RelinkDialog
      isOpen={openDialog === "relink"}
      onClose={close}
      title={title}
      documentId={record.document.id}
      replacingCatalogId={
        record.document.catalogState?.kind === "replaced"
          ? record.document.catalogState.catalogId
          : ""
      }
    />
  );
  if (iteration === null || isOwn) {
    return (
      <>
        <ActionBar
          actions={actions}
          menuLabel={i18n.t("actions.more", { ns: "documents" })}
          className={className}
        />
        {withdrawDialog}
        {relinkDialog}
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
      label: i18n.t("actions.reclassify", { ns: "documents" }),
      isInMenu: true,
      onSelect: open("reclassify"),
    });
  }

  if (mayDo("iteration.publish") && isPublishable(iteration)) {
    actions.push({
      id: "publish",
      label: i18n.t("actions.addLink", { ns: "documents" }),
      isInMenu: true,
      onSelect: open("publish"),
    });
  }

  // ACT-overrule: held at `any` only, never custody.
  if (mayDo("restriction.overrule") && isOverrulable(iteration)) {
    actions.push({
      id: "overrule",
      label: i18n.t("actions.overrule", { ns: "documents" }),
      isInMenu: true,
      isDestructive: true,
      onSelect: open("overrule"),
    });
  }

  if (mayDo("iteration.resume") && isResumable(iteration)) {
    actions.push({
      id: "resume",
      label: i18n.t("actions.resume", { ns: "documents" }),
      isInMenu: true,
      onSelect: open("resume"),
    });
  } else if (mayDo("iteration.cancel") && isCancellable(iteration)) {
    actions.push({
      id: "cancel",
      label: i18n.t("actions.cancel", { ns: "documents" }),
      isInMenu: true,
      isDestructive: true,
      onSelect: open("cancel"),
    });
  }

  return (
    <>
      <ActionBar
        actions={actions}
        menuLabel={i18n.t("actions.more", { ns: "documents" })}
        className={className}
      />
      {withdrawDialog}
      {relinkDialog}

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
        key={`publish-${iteration.id}-${iteration.links.length}`}
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
    refusalTexts: { 409: i18n.t("actions.withdraw409", { ns: "documents" }) },
  });
  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={i18n.t("actions.withdrawTitle", { ns: "documents", title })}
      description={i18n.t("actions.withdrawDescription", { ns: "documents" })}
      consequences={[
        { text: i18n.t("actions.withdrawConsequenceStatus", { ns: "documents" }) },
        { text: i18n.t("actions.withdrawConsequenceFinal", { ns: "documents" }) },
      ]}
      confirmLabel={i18n.t("actions.withdraw", { ns: "documents" })}
      cancelLabel={i18n.t("actions.keepIt", { ns: "documents" })}
      isDestructive
      onConfirm={() => withdraw.run(documentId)}
    />
  );
}

const relinkFormSchema = z.object({ catalogId: z.string().trim().min(1) });
type RelinkForm = z.infer<typeof relinkFormSchema>;

function RelinkDialog({
  isOpen,
  onClose,
  title,
  documentId,
  replacingCatalogId,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  documentId: string;
  replacingCatalogId: string;
}) {
  // ACT-relink: staff supply the catalog record that this document should follow.
  const id = useId();
  const mutation = useActionMutation({
    // ACT-relink: permissions, catalog identity and the follow-up checks are enforced by the server.
    call: ({ catalogId }: RelinkForm) => relinkDocument(documentId, catalogId),
    invalidates: iterationInvalidations,
    refusalTexts: {
      "document.catalog_unread": i18n.t("actions.relinkUnread", { ns: "documents" }),
      "document.same_catalog_record": i18n.t("actions.relinkSame", { ns: "documents" }),
      "document.catalog_record_held": i18n.t("actions.relinkHeld", { ns: "documents" }),
    },
  });
  const defaultValues: RelinkForm = { catalogId: replacingCatalogId };
  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={i18n.t("actions.relinkTitle", { ns: "documents", title })}
      description={i18n.t("actions.relinkDescription", { ns: "documents" })}
      schema={relinkFormSchema}
      defaultValues={defaultValues}
      submitLabel={i18n.t("actions.relink", { ns: "documents" })}
      onSubmit={(values) => mutation.run(values)}
      render={(form) => (
        <>
          <Field id={`${id}-catalog-id`} label={i18n.t("actions.catalogId", { ns: "documents" })}>
            <Input id={`${id}-catalog-id`} {...form.register("catalogId")} />
          </Field>
          <FieldError message={form.formState.errors.catalogId?.message} />
        </>
      )}
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
  link: z
    .string()
    .trim()
    .min(1, { error: () => i18n.t("actions.enterScanAddress", { ns: "documents" }) }),
});
type PublishForm = z.infer<typeof publishFormSchema>;

function PublishDialog({ isOpen, onClose, title, iteration }: ActionDialogProps) {
  const id = useId();
  const publish = useActionMutation({
    call: (publication: Publication) => addLink(iteration.id, publication),
    act: "ACT-publish",
    invalidates: iterationInvalidations,
    refusalTexts: {
      409: i18n.t("actions.notDigitized", { ns: "documents" }),
      "iteration.link_unread": i18n.t("actions.linkUnread", { ns: "documents" }),
      422: i18n.t("actions.linkExists", { ns: "documents" }),
    },
  });
  const defaultValues: PublishForm = { link: "" };

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={i18n.t("actions.addLinkTitle", { ns: "documents", title })}
      description={i18n.t("actions.addLinkDescription", { ns: "documents" })}
      schema={publishFormSchema}
      defaultValues={defaultValues}
      submitLabel={i18n.t("actions.save", { ns: "documents" })}
      onSubmit={(values) => publish.run(values)}
      render={(form) => (
        <>
          <Field
            id={`${id}-link`}
            label={i18n.t("detail.link", { ns: "documents" })}
            hint={i18n.t("actions.linkHint", { ns: "documents" })}
          >
            <Input
              id={`${id}-link`}
              placeholder={i18n.t("actions.linkPlaceholder", { ns: "documents" })}
              {...form.register("link")}
            />
          </Field>
          <FieldError message={form.formState.errors.link?.message} />
          <p className="text-xs text-muted-foreground">
            {i18n.t("actions.publishNotice", { ns: "documents" })}
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
    refusalTexts: { 409: i18n.t("actions.noRestriction", { ns: "documents" }) },
  });
  const rule = iteration.restriction?.rule ?? i18n.t("actions.aRule", { ns: "documents" });
  return (
    <ReasonDialog
      isOpen={isOpen}
      onClose={onClose}
      title={i18n.t("actions.overruleTitle", { ns: "documents", title })}
      description={i18n.t("actions.overruleDescription", { ns: "documents", rule })}
      internalNote={{
        label: i18n.t("actions.why", { ns: "documents" }),
        hint: i18n.t("actions.internalRuleHint", { ns: "documents" }),
        isRequired: true,
        placeholder: i18n.t("actions.overrulePlaceholder", { ns: "documents" }),
      }}
      confirmLabel={i18n.t("actions.overruleConfirm", { ns: "documents" })}
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
    refusalTexts: { 409: i18n.t("actions.cancel409", { ns: "documents" }) },
  });
  return (
    <ReasonDialog
      isOpen={isOpen}
      onClose={onClose}
      title={i18n.t("actions.cancelTitle", { ns: "documents", title })}
      description={
        iteration.listId === null
          ? i18n.t("actions.cancelDescription", { ns: "documents" })
          : i18n.t("actions.cancelListDescription", { ns: "documents" })
      }
      publicText={{
        label: i18n.t("actions.reason", { ns: "documents" }),
        hint:
          askerCount <= 1
            ? i18n.t("actions.oneAskerReads", { ns: "documents" })
            : i18n.t("actions.askersRead", { ns: "documents", count: askerCount }),
        isRequired: true,
        placeholder: i18n.t("actions.cancelPlaceholder", { ns: "documents" }),
      }}
      internalNote={{
        label: i18n.t("actions.internalNote", { ns: "documents" }),
        hint: i18n.t("actions.optionalStaffOnly", { ns: "documents" }),
        isRequired: false,
      }}
      confirmLabel={i18n.t("actions.cancelConfirm", { ns: "documents" })}
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
    refusalTexts: { 409: i18n.t("actions.resume409", { ns: "documents" }) },
  });
  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={i18n.t("actions.resumeTitle", { ns: "documents", title })}
      description={i18n.t("actions.resumeDescription", { ns: "documents" })}
      consequences={[
        {
          text:
            iteration.listId === null
              ? i18n.t("actions.resumeConsequence", { ns: "documents" })
              : i18n.t("actions.resumeListConsequence", { ns: "documents" }),
        },
        { text: i18n.t("actions.resumeAskers", { ns: "documents" }) },
      ]}
      confirmLabel={i18n.t("actions.resume", { ns: "documents" })}
      isDestructive={false}
      onConfirm={() => resume.run(undefined)}
    />
  );
}
