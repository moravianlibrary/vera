// What is done to a project (projects.md §2–§3; flows.md PJ1–PJ6, D11, D12; page-projects.js
// modals). One editor starts and edits it; the manager and the members are their own act. The
// decision is said before it is made, from the server's dry run: approving picks the priority
// and lists what it approves and the copies it skips; rejecting asks a reason every member reads
// and says what stays with other askers. Deleting is offered only while nothing was proposed.
// TODO(rrandiak): the Members dialog moves onto PickerDialog (component-interfaces.md §6.6) once
// Users & Groups builds it (plan.md step 9); labels move to i18n.

import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { z } from "zod";
import type { DecidedDocument, ProjectDetail, ProjectDraft, ProjectRow } from "@/api/projects";
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
import type { Priority } from "@/domain/entities";
import { prioritySchema } from "@/domain/entities";
import { intentionsQueryKey } from "@/features/intentions/use-intentions-query";
import { projectInvalidations, projectsQueryKey } from "@/features/projects/use-projects-query";
import type { Refusal } from "@/hooks/use-action-mutation";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useGroupsQuery, useUsersQuery } from "@/hooks/use-reference-query";
import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";

const decidedTexts = {
  "project.decided": "It has been decided meanwhile; a decision is final.",
  "project.has_proposals": "Something has been proposed into it meanwhile, so it stays.",
} as const;

// A project's acts change its own intention too: made, recounted, archived or deleted with it.
const invalidations = [...projectInvalidations, intentionsQueryKey];

// ---------------------------------------------------------------- start and edit

// As typed: the target is digits until it is sent, and empty for none.
const projectFormSchema = z
  .object({
    name: z.string().trim().min(1, "A project needs a name"),
    description: z.string(),
    startsOn: z.string().min(1, "A project is time-boxed: it needs both dates"),
    endsOn: z.string().min(1, "A project is time-boxed: it needs both dates"),
    targetPages: z.string().regex(/^\s*([1-9][\d\s,]*)?$/, "Pages, as a whole number above 0"),
  })
  .refine((values) => values.endsOn >= values.startsOn, {
    message: "It cannot end before it starts",
    path: ["endsOn"],
  });
type ProjectForm = z.infer<typeof projectFormSchema>;

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
  const id = useId();
  const project = row?.project ?? null;
  const save = useActionMutation({
    call: (draft: ProjectDraft) =>
      project === null ? createProject(draft) : saveProject(project.id, draft),
    invalidates: invalidations,
    refusalTexts: { 403: "You may no longer edit this project." },
  });

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={project === null ? "New project" : `Edit ${project.name}`}
      description={
        project === null
          ? "Start a project: money and a deadline that members propose documents into."
          : "Change what the project is, its dates and its target."
      }
      schema={projectFormSchema}
      defaultValues={{
        name: project?.name ?? "",
        description: project?.description ?? "",
        startsOn: project?.startsOn ?? "",
        endsOn: project?.endsOn ?? "",
        targetPages: String(row?.intention.targetPages ?? ""),
      }}
      submitLabel={project === null ? "Propose project" : "Save"}
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
        return isMoved
          ? "It is approved: its period and pace follow the new dates and target. Nothing it funded moves, and its decision and priority stay."
          : null;
      }}
      render={(form) => (
        <>
          <Field id={`${id}-name`} label="Name">
            <Input
              id={`${id}-name`}
              placeholder="e.g. NDK Periodika 2027"
              {...form.register("name")}
            />
          </Field>
          <FieldError message={form.formState.errors.name?.message} />
          <Field
            id={`${id}-description`}
            label="Description"
            hint="what it is for; members and curators read it"
          >
            <Textarea id={`${id}-description`} rows={3} {...form.register("description")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${id}-starts`} label="Starts">
              <Input id={`${id}-starts`} type="date" {...form.register("startsOn")} />
            </Field>
            <Field id={`${id}-ends`} label="Ends">
              <Input id={`${id}-ends`} type="date" {...form.register("endsOn")} />
            </Field>
          </div>
          <FieldError
            message={
              form.formState.errors.startsOn?.message ?? form.formState.errors.endsOn?.message
            }
          />
          <Field id={`${id}-target`} label="Target pages" hint="none: its intention tracks the mix">
            <Input
              id={`${id}-target`}
              inputMode="numeric"
              placeholder="e.g. 4,000"
              {...form.register("targetPages")}
            />
          </Field>
          <FieldError message={form.formState.errors.targetPages?.message} />
          {row !== null && <FiguresChange row={row} values={form.watch()} />}
          {project === null && (
            <p className="text-xs text-muted-foreground">
              It starts <b className="font-semibold">Proposed</b>, with you as its manager and only
              member. Members propose documents into it; a curator approves or rejects it.
            </p>
          )}
        </>
      )}
    />
  );
}

// New dates move its intention's window and recount it: said before saving, from the server
// (intentions.md §3.4).
function FiguresChange({ row, values }: { row: ProjectRow; values: ProjectForm }) {
  const parsed = projectFormSchema.safeParse(values);
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
      ["Planned", change.plannedPages],
      ["Delivered", change.deliveredPages],
    ] as const
  ).filter(([, figure]) => figure.before !== figure.after);
  return (
    <p className="rounded-md border border-dashed px-3 py-2 text-xs">
      Its intention counts over the new dates:{" "}
      {moves.length === 0 ? (
        <span className="text-muted-foreground">its figures do not change.</span>
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
    refusalTexts: { 403: "You may no longer change who is on it." },
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
      title={`Members — ${project.name}`}
      description="Who is on the project, and who manages it."
      isDirty={isDirty}
      refusal={refusal}
      primary={{ label: "Save members", isPending, onSelect: () => void confirm() }}
    >
      <div className="grid gap-5">
        <Field
          id={`${id}-manager`}
          label="Manager"
          hint="edits it and its members; always a member"
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
            Handing over: {nameOf(project.managerId)} stays a member until removed.
          </p>
        )}

        <div className="grid gap-1.5">
          <p className="text-sm font-medium">People</p>
          <ul className="divide-y rounded-md border text-sm">
            {state.memberIds.map((userId) => (
              <li key={userId} className="flex items-center gap-2 px-3 py-1.5">
                <span className="min-w-0 flex-1">{nameOf(userId)}</span>
                {userId === state.managerId ? (
                  <span className="text-xs text-muted-foreground">manager</span>
                ) : (
                  <RemoveButton
                    label={`Remove ${nameOf(userId)}`}
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
              placeholder="Add a person…"
              options={freePeople.map((user) => ({ value: user.id, label: user.name }))}
              onAdd={(userId) => setState({ ...state, memberIds: [...state.memberIds, userId] })}
            />
          )}
        </div>

        <div className="grid gap-1.5">
          <p className="text-sm font-medium">
            Groups{" "}
            <span className="font-normal text-muted-foreground">
              — everyone in one is a member while they are in it
            </span>
          </p>
          {state.memberGroupIds.length === 0 ? (
            <p className="text-xs text-muted-foreground">No group.</p>
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
                          · {plural(group.peopleCount, "person", "people")}
                        </span>
                      )}
                    </span>
                    <RemoveButton
                      label={`Remove ${group?.name ?? groupId}`}
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
              placeholder="Add a group…"
              options={freeGroups.map((group) => ({ value: group.id, label: group.name }))}
              onAdd={(groupId) =>
                setState({ ...state, memberGroupIds: [...state.memberGroupIds, groupId] })
              }
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Members propose documents into it. Removing someone leaves what they proposed in the
          project.
        </p>
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
    <ul className="mt-1 grid list-disc gap-1 pl-4.5 text-[0.8125rem]">
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
  const id = useId();
  const { project } = row;
  const { data: dryRun } = useDecisionDryRun(project.id, isOpen);
  const approve = useActionMutation({
    call: (priority: Priority) => approveProject(project.id, { priority }),
    invalidates: invalidations,
    refusalTexts: decidedTexts,
  });
  const approvedCount = dryRun?.approves.length ?? 0;

  return (
    <FormDialog<ApprovalForm>
      isOpen={isOpen}
      onClose={onClose}
      title={`Approve ${project.name}`}
      description="Approve the project at a priority, with what is pending in it."
      schema={approvalFormSchema}
      defaultValues={{ priority: "Normal" }}
      submitLabel={
        approvedCount === 0 ? "Approve" : `Approve and ${plural(approvedCount, "proposal")}`
      }
      onSubmit={({ priority }) => approve.run(priority)}
      render={(form) => (
        <>
          <Field
            id={`${id}-priority`}
            label="Priority"
            hint="set once; the proposals approved with it take it"
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
            <p className="text-xs text-muted-foreground">Counting what it approves…</p>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium">
                  It approves{" "}
                  <span className="font-normal text-muted-foreground">
                    — {plural(dryRun.approves.length, "document")} pending in it
                  </span>
                </p>
                {dryRun.approves.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">Nothing is pending in it.</p>
                ) : (
                  <DocumentList documents={dryRun.approves} />
                )}
              </div>
              {dryRun.skips.length > 0 && (
                <div>
                  <p className="text-sm font-medium">
                    It skips{" "}
                    <span className="font-normal text-muted-foreground">
                      — a copy exists; each is decided on its own, as a rescan
                    </span>
                  </p>
                  <DocumentList documents={dryRun.skips} />
                </div>
              )}
            </>
          )}
          <p className="text-xs text-muted-foreground">
            Approved is final. Proposals made after it carry <i>after the project's approval</i> and
            are decided on their own in Requests, with this priority pre-filled.
          </p>
        </>
      )}
    />
  );
}

// Only the project's own asks are rejected; a document others asked for stays theirs (flows.md
// D12).
export function RejectDialog({ isOpen, onClose, row }: DecisionDialogProps) {
  const { project } = row;
  const { data: dryRun } = useDecisionDryRun(project.id, isOpen);
  const reject = useActionMutation({
    call: (reason: string) => rejectProject(project.id, { reason }),
    invalidates: invalidations,
    refusalTexts: decidedTexts,
  });

  return (
    <ReasonDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Reject ${project.name}`}
      description="Reject the project, with a reason its members read."
      publicText={{
        label: "Reason",
        hint: "required; every member reads it",
        isRequired: true,
        placeholder: "Why it is not going ahead",
      }}
      fields={
        dryRun !== undefined &&
        dryRun.pending.length > 0 && (
          <div>
            <p className="text-sm font-medium">Its proposals</p>
            <ul className="mt-1 grid list-disc gap-1 pl-4.5 text-[0.8125rem]">
              {dryRun.pending.map((document) => (
                <li key={document.documentId}>
                  {document.title}{" "}
                  <span className="text-muted-foreground">
                    —{" "}
                    {document.isAskedByOthers
                      ? "others asked for it too: only the project's request is rejected, theirs stay"
                      : "declined"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      }
      reach="Rejected is final and takes no more proposals. To try again, start a new project."
      confirmLabel="Reject project"
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
  const { project } = row;
  const remove = useActionMutation({
    call: deleteProject,
    invalidates: invalidations,
    refusalTexts: decidedTexts,
  });

  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Delete ${project.name}?`}
      description="Delete a project nothing has been proposed into."
      consequences={[
        { text: "Nothing has been proposed into it, so nothing depends on it." },
        {
          text: `It goes, with its intention and ${plural(project.memberIds.length, "member")}; its history keeps that it was deleted.`,
        },
      ]}
      confirmLabel="Delete project"
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
