// What is done to a project (projects.md §2–§3; flows.md PJ1–PJ6, D11, D12; page-projects.js
// modals). One editor starts and edits it; the manager and the members are their own act. The
// decision is said before it is made, from the server's dry run: approving picks the priority
// and lists what it approves and the copies it skips; rejecting asks a reason every member reads
// and says what stays with other askers. Deleting is offered only while nothing was proposed.
// TODO(rrandiak): the Members dialog moves onto PickerDialog (component-interfaces.md §6.6) once
// Users & Groups builds it (plan.md step 9).

import { useQuery } from "@tanstack/react-query";
import type {
  DecidedDocument,
  ProjectDetail,
  ProjectDraft,
  ProjectRow,
} from "@vera/contract/projects";
import type { Priority } from "@vera/domain/entities";
import { prioritySchema } from "@vera/domain/entities";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  approveProject,
  createProject,
  deleteProject,
  previewDecision,
  previewProjectChange,
  rejectProject,
  saveProject,
  saveProjectMembers,
} from "@/api/projects";
import { Field, PrioritySelect } from "@/components/classification-fields";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { ReasonDialog } from "@/components/dialogs/reason-dialog";
import { AddSelect, RemoveButton } from "@/components/fields/picked-list";
import { FieldError } from "@/components/iteration-dialogs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { intentionsQueryKey } from "@/features/intentions/use-intentions-query";
import { projectInvalidations, projectsQueryKey } from "@/features/projects/use-projects-query";
import type { Refusal } from "@/hooks/use-action-mutation";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useGroupsQuery, useUsersQuery } from "@/hooks/use-reference-query";
import { formatCount } from "@/lib/format-number";

const decidedTextsOf = (t: (key: string) => string) => ({
  "project.decided": t("projectDialogs.decided"),
  "project.has_proposals": t("projectDialogs.hasProposals"),
});

// A project's acts change its own intention too: made, recounted, archived or deleted with it.
const invalidations = [...projectInvalidations, intentionsQueryKey];

// ---------------------------------------------------------------- start and edit

// As typed: the target is digits until it is sent, and empty for none.
const projectFormSchemaOf = (t: (key: string) => string) =>
  z
    .object({
      name: z.string().trim().min(1, t("projectDialogs.nameRequired")),
      description: z.string(),
      startsOn: z.string().min(1, t("projectDialogs.datesRequired")),
      endsOn: z.string().min(1, t("projectDialogs.datesRequired")),
      targetPages: z.string().regex(/^\s*([1-9][\d\s,]*)?$/, t("projectDialogs.pagesPositive")),
    })
    .refine((values) => values.endsOn >= values.startsOn, {
      message: t("projectDialogs.endsBeforeStarts"),
      path: ["endsOn"],
    });
type ProjectForm = z.infer<ReturnType<typeof projectFormSchemaOf>>;

const draftOf = (values: ProjectForm): ProjectDraft => ({
  name: values.name.trim(),
  description: values.description.trim(),
  startsOn: values.startsOn,
  endsOn: values.endsOn,
  targetPages:
    values.targetPages.trim() === "" ? null : Number(values.targetPages.replace(/\D/g, "")),
});

interface ProjectFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // None starts a new one.
  row: ProjectRow | null;
  onSaved: (detail: ProjectDetail) => void;
}

// A new project is an empty one; the manager is not here, since handing over is a members act
// (projects.md §3). The target is its intention's, made with it; new dates move that intention's
// window, and the form shows what that does to its figures before saving (§1.1).
export function ProjectFormDialog({ isOpen, onClose, row, onSaved }: ProjectFormDialogProps) {
  const { t } = useTranslation("projects");
  const schema = projectFormSchemaOf(t);
  const id = useId();
  const project = row?.project ?? null;
  const save = useActionMutation({
    call: (draft: ProjectDraft) =>
      project === null ? createProject(draft) : saveProject(project.id, draft),
    invalidates: invalidations,
    refusalTexts: { 403: t("projectDialogs.cannotEdit") },
  });

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        project === null
          ? t("projectDialogs.newProject")
          : t("projectDialogs.editProject", { name: project.name })
      }
      description={
        project === null
          ? t("projectDialogs.startDescription")
          : t("projectDialogs.editDescription")
      }
      schema={schema}
      defaultValues={{
        name: project?.name ?? "",
        description: project?.description ?? "",
        startsOn: project?.startsOn ?? "",
        endsOn: project?.endsOn ?? "",
        targetPages: String(row?.intention.targetPages ?? ""),
      }}
      submitLabel={project === null ? t("projectDialogs.proposeProject") : t("projectDialogs.save")}
      onSubmit={async (values) => {
        const result = await save.run(draftOf(values));
        if (result.isDone) {
          onSaved(result.value);
        }

        return result;
      }}
      // A grant can be extended, so an approved project's dates and target still change; its
      // pace follows (flows.md PJ6).
      warningOf={(values) => {
        if (row === null || project === null || project.state !== "Approved") {
          return null;
        }

        const draft = draftOf(values);
        const isMoved =
          draft.startsOn !== project.startsOn ||
          draft.endsOn !== project.endsOn ||
          draft.targetPages !== row.intention.targetPages;
        return isMoved ? t("projectDialogs.approvedChangeWarning") : null;
      }}
      render={(form) => (
        <>
          <Field id={`${id}-name`} label={t("projectDialogs.name")}>
            <Input
              id={`${id}-name`}
              placeholder={t("projectDialogs.namePlaceholder")}
              {...form.register("name")}
            />
          </Field>
          <FieldError message={form.formState.errors.name?.message} />
          <Field
            id={`${id}-description`}
            label={t("projectDialogs.description")}
            hint={t("projectDialogs.descriptionHint")}
          >
            <Textarea id={`${id}-description`} rows={3} {...form.register("description")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${id}-starts`} label={t("projectDialogs.starts")}>
              <Input id={`${id}-starts`} type="date" {...form.register("startsOn")} />
            </Field>
            <Field id={`${id}-ends`} label={t("projectDialogs.ends")}>
              <Input id={`${id}-ends`} type="date" {...form.register("endsOn")} />
            </Field>
          </div>
          <FieldError
            message={
              form.formState.errors.startsOn?.message ?? form.formState.errors.endsOn?.message
            }
          />
          <Field
            id={`${id}-target`}
            label={t("projectDialogs.targetPages")}
            hint={t("projectDialogs.noTargetHint")}
          >
            <Input
              id={`${id}-target`}
              inputMode="numeric"
              placeholder={t("projectDialogs.pagesPlaceholder")}
              {...form.register("targetPages")}
            />
          </Field>
          <FieldError message={form.formState.errors.targetPages?.message} />
          {row !== null && <FiguresChange row={row} values={form.watch()} />}
          {project === null && (
            <p className="text-xs text-muted-foreground">{t("projectDialogs.newProjectNote")}</p>
          )}
        </>
      )}
    />
  );
}

// New dates move its intention's window and recount it: said before saving, from the server
// (intentions.md §3.4).
function FiguresChange({ row, values }: { row: ProjectRow; values: ProjectForm }) {
  const { t } = useTranslation("projects");
  const parsed = projectFormSchemaOf(t).safeParse(values);
  const draft = parsed.success ? draftOf(parsed.data) : null;
  const isMoved =
    draft !== null &&
    (draft.startsOn !== row.project.startsOn || draft.endsOn !== row.project.endsOn);
  const { data: change } = useQuery({
    queryKey: [...projectsQueryKey, "change", row.project.id, draft],
    queryFn: () => previewProjectChange(row.project.id, draft as ProjectDraft),
    enabled: isMoved,
  });
  if (!isMoved || change === undefined) {
    return null;
  }

  const moves = (
    [
      [t("projectDialogs.planned"), change.plannedPages],
      [t("projectDialogs.delivered"), change.deliveredPages],
    ] as const
  ).filter(([, figure]) => figure.before !== figure.after);
  return (
    <p className="rounded-md border border-dashed px-3 py-2 text-xs">
      {t("projectDialogs.intentionNewDates")}{" "}
      {moves.length === 0 ? (
        <span className="text-muted-foreground">{t("projectDialogs.figuresUnchanged")}</span>
      ) : (
        moves.map(([label, figure], index) => (
          <span key={label}>
            {index > 0 && " · "}
            {label}{" "}
            <b className="font-semibold tabular-nums">
              {formatCount(figure.before)} → {formatCount(figure.after)}
            </b>
          </span>
        ))
      )}
    </p>
  );
}

// ---------------------------------------------------------------- members

interface MembersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  row: ProjectRow;
}

interface MembersState {
  managerId: string;
  memberIds: readonly string[];
  memberGroupIds: readonly string[];
}

// The whole set at once. The manager is always a member; handing over keeps the old one a member
// until removed, and a removed member's proposals stay in the project (flows.md PJ2, PJ4).
export function MembersDialog({ isOpen, onClose, row }: MembersDialogProps) {
  const { t } = useTranslation("projects");
  const id = useId();
  const { project } = row;
  const initial: MembersState = {
    managerId: project.managerId,
    memberIds: project.memberIds,
    memberGroupIds: project.memberGroupIds,
  };
  const [state, setState] = useState<MembersState>(initial);
  const [isPending, setIsPending] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const { data: users = [] } = useUsersQuery();
  const { data: groups = [] } = useGroupsQuery({ isEnabled: isOpen });
  const save = useActionMutation({
    call: (members: MembersState) =>
      saveProjectMembers(project.id, {
        managerId: members.managerId,
        memberIds: [...members.memberIds],
        memberGroupIds: [...members.memberGroupIds],
      }),
    invalidates: invalidations,
    refusalTexts: { 403: t("projectDialogs.cannotChangeMembers") },
  });
  const nameOf = (userId: string) => users.find((user) => user.id === userId)?.name ?? userId;
  const people = users.filter((user) => user.kind === "person");
  const freePeople = people.filter((user) => !state.memberIds.includes(user.id));
  const freeGroups = groups.filter((group) => !state.memberGroupIds.includes(group.id));
  const isDirty =
    state.managerId !== initial.managerId ||
    state.memberIds.join() !== initial.memberIds.join() ||
    state.memberGroupIds.join() !== initial.memberGroupIds.join();

  const close = () => {
    setState(initial);
    setRefusal(null);
    onClose();
  };

  const confirm = async () => {
    setIsPending(true);
    const result = await save.run(state);
    setIsPending(false);
    if (!result.isDone) {
      setRefusal(result.refusal);
      return;
    }

    close();
  };

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={close}
      title={t("projectDialogs.membersTitle", { name: project.name })}
      description={t("projectDialogs.membersDescription")}
      isDirty={isDirty}
      refusal={refusal}
      primary={{
        label: t("projectDialogs.saveMembers"),
        isPending,
        onSelect: () => void confirm(),
      }}
    >
      <div className="grid gap-5">
        <Field
          id={`${id}-manager`}
          label={t("projectDialogs.manager")}
          hint={t("projectDialogs.managerHint")}
        >
          <Select
            value={state.managerId}
            onValueChange={(managerId) => setState({ ...state, managerId })}
          >
            <SelectTrigger id={`${id}-manager`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {state.memberIds.map((userId) => (
                <SelectItem key={userId} value={userId}>
                  {nameOf(userId)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {state.managerId !== project.managerId && (
          <p className="-mt-3 text-xs text-muted-foreground">
            {t("projectDialogs.handingOver", { name: nameOf(project.managerId) })}
          </p>
        )}

        <div className="grid gap-1.5">
          <p className="text-sm font-medium">{t("projectDialogs.people")}</p>
          <ul className="divide-y rounded-md border text-sm">
            {state.memberIds.map((userId) => (
              <li key={userId} className="flex items-center gap-2 px-3 py-1.5">
                <span className="min-w-0 flex-1">{nameOf(userId)}</span>
                {userId === state.managerId ? (
                  <span className="text-xs text-muted-foreground">
                    {t("projectDialogs.manager")}
                  </span>
                ) : (
                  <RemoveButton
                    label={t("projectDialogs.remove", { name: nameOf(userId) })}
                    onSelect={() =>
                      setState({
                        ...state,
                        memberIds: state.memberIds.filter((memberId) => memberId !== userId),
                      })
                    }
                  />
                )}
              </li>
            ))}
          </ul>
          {freePeople.length > 0 && (
            <AddSelect
              placeholder={t("projectDialogs.addPerson")}
              options={freePeople.map((user) => ({ value: user.id, label: user.name }))}
              onAdd={(userId) => setState({ ...state, memberIds: [...state.memberIds, userId] })}
            />
          )}
        </div>

        <div className="grid gap-1.5">
          <p className="text-sm font-medium">
            {t("projectDialogs.groups")}{" "}
            <span className="font-normal text-muted-foreground">
              — {t("projectDialogs.groupMembersHint")}
            </span>
          </p>
          {state.memberGroupIds.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("projectDialogs.noGroup")}</p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {state.memberGroupIds.map((groupId) => {
                const group = groups.find((candidate) => candidate.id === groupId);
                return (
                  <li key={groupId} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="min-w-0 flex-1">
                      {group?.name ?? groupId}{" "}
                      {group !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          · {t("projectDialogs.person", { count: group.peopleCount })}
                        </span>
                      )}
                    </span>
                    <RemoveButton
                      label={t("projectDialogs.remove", { name: group?.name ?? groupId })}
                      onSelect={() =>
                        setState({
                          ...state,
                          memberGroupIds: state.memberGroupIds.filter(
                            (memberId) => memberId !== groupId,
                          ),
                        })
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {freeGroups.length > 0 && (
            <AddSelect
              placeholder={t("projectDialogs.addGroup")}
              options={freeGroups.map((group) => ({ value: group.id, label: group.name }))}
              onAdd={(groupId) =>
                setState({ ...state, memberGroupIds: [...state.memberGroupIds, groupId] })
              }
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("projectDialogs.membersFootnote")}</p>
      </div>
    </DialogShell>
  );
}

// ---------------------------------------------------------------- the decision

function useDecisionDryRun(projectId: string, isOpen: boolean) {
  return useQuery({
    queryKey: [...projectsQueryKey, "dryRun", "decision", projectId],
    queryFn: () => previewDecision(projectId),
    enabled: isOpen,
    gcTime: 0,
  });
}

function DocumentList({ documents }: { documents: readonly DecidedDocument[] }) {
  return (
    <ul className="mt-1 grid list-disc gap-1 pl-4.5 text-ui">
      {documents.map((document) => (
        <li key={document.documentId}>{document.title}</li>
      ))}
    </ul>
  );
}

interface DecisionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  row: ProjectRow;
}

const approvalFormSchema = z.object({ priority: prioritySchema });
type ApprovalForm = z.infer<typeof approvalFormSchema>;

// Approving picks the priority, set once; it approves what is pending at that moment but the
// copies, which are decided on their own as rescans (flows.md D11).
export function ApproveDialog({ isOpen, onClose, row }: DecisionDialogProps) {
  const { t } = useTranslation("projects");
  const id = useId();
  const { project } = row;
  const { data: dryRun } = useDecisionDryRun(project.id, isOpen);
  const approve = useActionMutation({
    call: (priority: Priority) => approveProject(project.id, { priority }),
    invalidates: invalidations,
    refusalTexts: decidedTextsOf(t),
  });
  const approvedCount = dryRun?.approves.length ?? 0;

  return (
    <FormDialog<ApprovalForm>
      isOpen={isOpen}
      onClose={onClose}
      title={t("projectDialogs.approveTitle", { name: project.name })}
      description={t("projectDialogs.approveDescription")}
      schema={approvalFormSchema}
      defaultValues={{ priority: "Normal" }}
      submitLabel={
        approvedCount === 0
          ? t("projectDialogs.approve")
          : t("projectDialogs.approveProposals", { count: approvedCount })
      }
      onSubmit={({ priority }) => approve.run(priority)}
      render={(form) => (
        <>
          <Field
            id={`${id}-priority`}
            label={t("projectDialogs.priority")}
            hint={t("projectDialogs.priorityHint")}
          >
            <PrioritySelect
              id={`${id}-priority`}
              value={form.watch("priority")}
              onChange={(priority: Priority) =>
                form.setValue("priority", priority, { shouldDirty: true })
              }
            />
          </Field>
          {dryRun === undefined ? (
            <p className="text-xs text-muted-foreground">{t("projectDialogs.countingApprovals")}</p>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium">
                  {t("projectDialogs.itApproves")}{" "}
                  <span className="font-normal text-muted-foreground">
                    — {t("projectDialogs.documentsPending", { count: dryRun.approves.length })}
                  </span>
                </p>
                {dryRun.approves.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("projectDialogs.nothingPending")}
                  </p>
                ) : (
                  <DocumentList documents={dryRun.approves} />
                )}
              </div>
              {dryRun.skips.length > 0 && (
                <div>
                  <p className="text-sm font-medium">
                    {t("projectDialogs.itSkips")}{" "}
                    <span className="font-normal text-muted-foreground">
                      — {t("projectDialogs.copyRescans")}
                    </span>
                  </p>
                  <DocumentList documents={dryRun.skips} />
                </div>
              )}
            </>
          )}
          <p className="text-xs text-muted-foreground">{t("projectDialogs.approvedFootnote")}</p>
        </>
      )}
    />
  );
}

// Only the project's own asks are rejected; a document others asked for stays theirs (flows.md
// D12).
export function RejectDialog({ isOpen, onClose, row }: DecisionDialogProps) {
  const { t } = useTranslation("projects");
  const { project } = row;
  const { data: dryRun } = useDecisionDryRun(project.id, isOpen);
  const reject = useActionMutation({
    call: (reason: string) => rejectProject(project.id, { reason }),
    invalidates: invalidations,
    refusalTexts: decidedTextsOf(t),
  });

  return (
    <ReasonDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("projectDialogs.rejectTitle", { name: project.name })}
      description={t("projectDialogs.rejectDescription")}
      publicText={{
        label: t("projectDialogs.reason"),
        hint: t("projectDialogs.reasonRequired"),
        isRequired: true,
        placeholder: t("projectDialogs.rejectPlaceholder"),
      }}
      fields={
        dryRun !== undefined &&
        dryRun.pending.length > 0 && (
          <div>
            <p className="text-sm font-medium">{t("projectDialogs.itsProposals")}</p>
            <ul className="mt-1 grid list-disc gap-1 pl-4.5 text-ui">
              {dryRun.pending.map((document) => (
                <li key={document.documentId}>
                  {document.title}{" "}
                  <span className="text-muted-foreground">
                    —{" "}
                    {document.isAskedByOthers
                      ? t("projectDialogs.othersAskedToo")
                      : t("projectDialogs.declined")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      }
      reach={t("projectDialogs.rejectReach")}
      confirmLabel={t("projectDialogs.rejectProject")}
      isDestructive
      onConfirm={({ publicText }) => reject.run(publicText)}
    />
  );
}

// ---------------------------------------------------------------- delete

interface DeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  row: ProjectRow;
  onDeleted: () => void;
}

// Offered only while nothing was proposed into it, so nothing depends on it; anything else is
// history and stays (projects.md §3).
export function DeleteProjectDialog({ isOpen, onClose, row, onDeleted }: DeleteDialogProps) {
  const { t } = useTranslation("projects");
  const { project } = row;
  const remove = useActionMutation({
    call: deleteProject,
    invalidates: invalidations,
    refusalTexts: decidedTextsOf(t),
  });

  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("projectDialogs.deleteTitle", { name: project.name })}
      description={t("projectDialogs.deleteDescription")}
      consequences={[
        { text: t("projectDialogs.nothingDepends") },
        {
          text: t("projectDialogs.deleteConsequence", { count: project.memberIds.length }),
        },
      ]}
      confirmLabel={t("projectDialogs.deleteProject")}
      isDestructive
      onConfirm={async () => {
        const result = await remove.run(project.id);
        if (result.isDone) {
          onDeleted();
        }

        return result;
      }}
    />
  );
}
