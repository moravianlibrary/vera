// What is done to an intention and to a repeat (intentions.md §2.1–§2.2, §3, §3.3; flows.md M1–
// M4; page-intentions.js modals). One editor makes a new intention, edits one, and makes a new one
// from an old one, since the counting start is fixed once created. Its one mix field tracks an
// intention that owns its mix or owns a copy of one; the picker offers only owners, so a chain
// cannot be picked, and an owner others track switches only by moving them along. Before saving
// it says where the intention lands, what saving recounts and the percentages it would read
// beside the ones it reads now, all from the server's preview. Deleting says what was generated
// with it; a repeat changes only the occurrences still to come.
// TODO(rrandiak): labels move to i18n.

import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import type {
  IntentionDraft,
  IntentionPreviewRequest,
  IntentionRow,
  IntentionTemplateDraft,
  IntentionTemplateRow,
  MixChoice,
} from "@/api/intentions";
import {
  createIntention,
  createIntentionTemplate,
  deleteIntention,
  previewIntention,
  previewIntentionDeletion,
  saveIntention,
  saveIntentionTemplate,
} from "@/api/intentions";
import { Field } from "@/components/classification-fields";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { FieldError } from "@/components/iteration-dialogs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Category, IntentionFunding, Project, Session } from "@/domain/entities";
import { repeatEverySchema } from "@/domain/entities";
import { can } from "@/domain/permissions";
import { scopeOfProject } from "@/domain/projects";
import { columnTitles, everyLabels, shareTextOf } from "@/features/intentions/intentions-view";
import { intentionInvalidations } from "@/features/intentions/use-intentions-query";
import type { Refusal } from "@/hooks/use-action-mutation";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useCategoriesQuery, useProjectsQuery } from "@/hooks/use-reference-query";
import { formatCalendarDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";

const refusalTexts = {
  "intention.name": "Another intention already has that name.",
  "intention.tracked": "Others track its mix: move them along, or keep its own mix.",
  "intention.not_owner": "That intention tracks another one meanwhile; pick again.",
  "intention.counts_from": "The counting start is fixed once created.",
  403: "You may no longer change this intention.",
} as const;

// ---------------------------------------------------------------- shared fields

const allCategories = "all";
const fundingAny = "any";
const fundingNone = "none";

const fundingValueOf = (funding: IntentionFunding) =>
  funding.kind === "project" ? funding.projectId : funding.kind;

const fundingOf = (value: string): IntentionFunding =>
  value === fundingAny || value === fundingNone
    ? { kind: value }
    : { kind: "project", projectId: value };

const pagesText = /^\s*([1-9][\d\s,]*)?$/;
const pagesOf = (text: string) => (text.trim() === "" ? null : Number(text.replace(/\D/g, "")));

// Any and no project only for whoever reaches what no project funds; a project for whoever may
// set intentions on it.
function FundingSelect({
  id,
  value,
  session,
  onChange,
}: {
  id: string;
  value: string;
  session: Session;
  onChange: (value: string, project: Project | null) => void;
}) {
  const { data: projects = [] } = useProjectsQuery();
  const canUnscoped = can(session, "intention.edit", { kind: "unscoped" });
  const offered = projects.filter(
    (project) => project.id === value || can(session, "intention.edit", scopeOfProject(project)),
  );
  return (
    <Select
      value={value}
      onValueChange={(picked) =>
        onChange(picked, projects.find((project) => project.id === picked) ?? null)
      }
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(canUnscoped || value === fundingAny) && (
          <SelectItem value={fundingAny}>Any — funded or not</SelectItem>
        )}
        {(canUnscoped || value === fundingNone) && (
          <SelectItem value={fundingNone}>No project</SelectItem>
        )}
        {offered.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// One node with its subtree, shown as the tree.
function ScopeSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { data: categories = [] } = useCategoriesQuery();
  const rows: { category: Category; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const category of categories.filter((candidate) => candidate.parentId === parentId)) {
      rows.push({ category, depth });
      walk(category.id, depth + 1);
    }
  };
  walk(null, 0);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={allCategories}>All categories</SelectItem>
        {rows.map(({ category, depth }) => (
          <SelectItem
            key={category.id}
            value={category.id}
            style={{ paddingLeft: `${depth + 1.5}rem` }}
          >
            {category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------- the mix field

const ownersOf = (rows: readonly IntentionRow[]) =>
  rows.filter((row) => row.intention.tracksMixOf === null).map((row) => row.intention);

// "keep", "track:i4" or "copy:i8", as the select holds it.
function mixChoiceOf(value: string, isMovingTrackers: boolean): MixChoice {
  const [kind, intentionId = ""] = value.split(":");
  if (kind === "track") {
    return { kind: "track", ownerId: intentionId, isMovingTrackers };
  }

  return kind === "copy" ? { kind: "copy", fromId: intentionId } : { kind: "keep" };
}

function MixSelect({
  id,
  value,
  rows,
  intentionId,
  isOwner,
  onChange,
}: {
  id: string;
  value: string;
  rows: readonly IntentionRow[];
  intentionId: string | null;
  isOwner: boolean;
  onChange: (value: string) => void;
}) {
  const others = ownersOf(rows).filter((owner) => owner.id !== intentionId);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {isOwner && <SelectItem value="keep">Own mix — keep it</SelectItem>}
        {others.map((owner) => (
          <SelectItem key={`track:${owner.id}`} value={`track:${owner.id}`}>
            Track {owner.name}
            {owner.isOverall && " (Overall)"}
          </SelectItem>
        ))}
        {others.map((owner) => (
          <SelectItem key={`copy:${owner.id}`} value={`copy:${owner.id}`}>
            Own mix, copied from {owner.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------- the intention editor

export type IntentionSource =
  | { kind: "new" }
  | { kind: "edit"; row: IntentionRow }
  | { kind: "copy"; row: IntentionRow };

const intentionFormSchema = z
  .object({
    name: z.string().trim().min(1, "An intention needs a name"),
    description: z.string(),
    funding: z.string(),
    scope: z.string(),
    mix: z.string(),
    isMovingTrackers: z.boolean(),
    // Whether the mix choice would make a chain unless those tracking it move along.
    isTracked: z.boolean(),
    targetPages: z.string().regex(pagesText, "A target is a number of pages, or none"),
    countsFrom: z.string().min(1, "Say when it starts counting"),
    endsOn: z.string(),
  })
  .refine((values) => values.endsOn === "" || values.endsOn >= values.countsFrom, {
    message: "It cannot end before it starts counting",
    path: ["endsOn"],
  })
  .refine(
    (values) => !values.isTracked || !values.mix.startsWith("track:") || values.isMovingTrackers,
    {
      message: "Others track its mix — move them along, or keep its own mix",
      path: ["isMovingTrackers"],
    },
  );
type IntentionForm = z.infer<typeof intentionFormSchema>;

const draftOf = (values: IntentionForm): IntentionDraft => ({
  name: values.name.trim(),
  description: values.description.trim(),
  funding: fundingOf(values.funding),
  scopeCategoryId: values.scope === allCategories ? null : values.scope,
  targetPages: pagesOf(values.targetPages),
  countsFrom: values.countsFrom,
  endsOn: values.endsOn === "" ? null : values.endsOn,
  mix: mixChoiceOf(values.mix, values.isMovingTrackers),
});

function defaultsOf(source: IntentionSource, rows: readonly IntentionRow[]): IntentionForm {
  const overall = rows.find((row) => row.intention.isOverall)?.intention;
  if (source.kind === "new") {
    return {
      name: "",
      description: "",
      funding: fundingAny,
      scope: allCategories,
      mix: overall === undefined ? "keep" : `track:${overall.id}`,
      isMovingTrackers: false,
      isTracked: false,
      targetPages: "",
      countsFrom: "",
      endsOn: "",
    };
  }

  const { intention, mix } = source.row;
  const isCopy = source.kind === "copy";
  // A new one from an old one reads the same mix: the owner it tracks, or a copy of its own.
  const mixValue = !mix.isOwn ? `track:${mix.owner.id}` : isCopy ? `copy:${intention.id}` : "keep";
  return {
    name: isCopy ? `${intention.name} (copy)` : intention.name,
    description: intention.description,
    funding: fundingValueOf(intention.funding),
    scope: intention.scopeCategoryId ?? allCategories,
    mix: mixValue,
    isMovingTrackers: false,
    isTracked: !isCopy && mix.trackerCount > 0,
    targetPages: intention.targetPages === null ? "" : String(intention.targetPages),
    countsFrom: isCopy ? "" : intention.countsFrom,
    endsOn: intention.endsOn ?? "",
  };
}

interface IntentionFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  source: IntentionSource;
  rows: readonly IntentionRow[];
  session: Session;
  onSaved: (row: IntentionRow) => void;
  // "Count from another date": a new one from this one.
  onCopy?: () => void;
  // Absent when it cannot be deleted.
  onDelete?: () => void;
}

export function IntentionFormDialog({
  isOpen,
  onClose,
  source,
  rows,
  session,
  onSaved,
  onCopy,
  onDelete,
}: IntentionFormDialogProps) {
  const id = useId();
  const edited = source.kind === "edit" ? source.row : null;
  const isOverall = edited?.intention.isOverall === true;
  const save = useActionMutation({
    call: (draft: IntentionDraft) =>
      edited === null ? createIntention(draft) : saveIntention(edited.intention.id, draft),
    invalidates: intentionInvalidations,
    refusalTexts,
  });
  const title =
    source.kind === "new"
      ? "New intention"
      : source.kind === "copy"
        ? `New intention from ${source.row.intention.name}`
        : `Edit ${source.row.intention.name}`;

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description="What it counts, the mix it reads, its target and its window."
      schema={intentionFormSchema}
      defaultValues={defaultsOf(source, rows)}
      submitLabel={edited === null ? "Create intention" : "Save"}
      secondary={
        onDelete === undefined
          ? undefined
          : { label: "Delete…", isDestructive: true, onSelect: onDelete }
      }
      onSubmit={async (values) => {
        const result = await save.run(draftOf(values));
        if (result.isDone) {
          onSaved(result.value);
        }

        return result;
      }}
      fieldOf={(refusal: Refusal) =>
        refusal.code === "intention.name"
          ? "name"
          : refusal.code === "intention.tracked"
            ? "isMovingTrackers"
            : null
      }
      render={(form) => (
        <>
          <Field id={`${id}-name`} label="Name">
            <Input
              id={`${id}-name`}
              placeholder="e.g. Regional weeklies 2027"
              {...form.register("name")}
            />
          </Field>
          <FieldError message={form.formState.errors.name?.message} />
          <Field id={`${id}-description`} label="Description" hint="optional">
            <Textarea id={`${id}-description`} rows={2} {...form.register("description")} />
          </Field>
          {edited !== null && isOverall ? (
            <OverallNote row={edited} session={session} />
          ) : (
            <IntentionFields
              id={id}
              form={form}
              source={source}
              rows={rows}
              session={session}
              onCopy={onCopy}
            />
          )}
        </>
      )}
    />
  );
}

function OverallNote({ row, session }: { row: IntentionRow; session: Session }) {
  return (
    <p className="text-xs text-muted-foreground">
      The Overall intention always counts everything from{" "}
      {formatCalendarDay(row.intention.countsFrom)}, has no target and no end. It always owns its
      mix
      {row.mix.trackerCount > 0 && `, which ${plural(row.mix.trackerCount, "other")} track`} —{" "}
      {can(session, "intention.edit_overall")
        ? "its percentages are changed on Categories."
        : "only an admin changes its percentages."}
    </p>
  );
}

interface IntentionFieldsProps {
  id: string;
  form: UseFormReturn<IntentionForm>;
  source: IntentionSource;
  rows: readonly IntentionRow[];
  session: Session;
  onCopy: (() => void) | undefined;
}

function IntentionFields({ id, form, source, rows, session, onCopy }: IntentionFieldsProps) {
  const edited = source.kind === "edit" ? source.row : null;
  const values = form.watch();
  const { errors } = form.formState;
  const touched = { shouldDirty: true } as const;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-funding`} label="Funding">
          <FundingSelect
            id={`${id}-funding`}
            value={values.funding}
            session={session}
            onChange={(value, project) => {
              form.setValue("funding", value, touched);
              // Choosing a project pre-fills its dates (§3); a fixed start stays.
              if (project !== null && edited === null) {
                form.setValue("countsFrom", project.startsOn, touched);
                form.setValue("endsOn", project.endsOn, touched);
              }
            }}
          />
        </Field>
        <Field id={`${id}-scope`} label="Categories" hint="one subtree">
          <ScopeSelect
            id={`${id}-scope`}
            value={values.scope}
            onChange={(value) => form.setValue("scope", value, touched)}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-mix`} label="Mix">
          <MixSelect
            id={`${id}-mix`}
            value={values.mix}
            rows={rows}
            intentionId={edited?.intention.id ?? null}
            isOwner={edited?.mix.isOwn === true}
            onChange={(value) => form.setValue("mix", value, touched)}
          />
        </Field>
        <Field id={`${id}-target`} label="Target pages" hint="none: it tracks the mix">
          <Input
            id={`${id}-target`}
            inputMode="numeric"
            placeholder="e.g. 4,000"
            {...form.register("targetPages")}
          />
        </Field>
      </div>
      <FieldError message={errors.targetPages?.message} />
      <MixNote
        id={id}
        form={form}
        edited={edited}
        rows={rows}
        error={errors.isMovingTrackers?.message}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {edited === null ? (
          <Field id={`${id}-from`} label="Counts from" hint="fixed once created">
            <Input id={`${id}-from`} type="date" {...form.register("countsFrom")} />
          </Field>
        ) : (
          <div className="grid gap-1.5 text-sm">
            <span className="font-medium">Counts from</span>
            <span>
              {formatCalendarDay(edited.intention.countsFrom)}{" "}
              <span className="text-muted-foreground">· fixed</span>
            </span>
            {onCopy !== undefined && (
              <button
                type="button"
                className="text-left text-xs text-primary underline-offset-2 hover:underline"
                onClick={onCopy}
              >
                Count from another date — make a new intention from this one
              </button>
            )}
          </div>
        )}
        <Field id={`${id}-ends`} label="Ends" hint="empty: no end">
          <Input id={`${id}-ends`} type="date" {...form.register("endsOn")} />
        </Field>
      </div>
      <FieldError message={errors.countsFrom?.message ?? errors.endsOn?.message} />
      <LandingNote values={values} edited={edited} />
    </>
  );
}

// What the mix choice does, said before Save (§2.2).
function MixNote({
  id,
  form,
  edited,
  rows,
  error,
}: {
  id: string;
  form: UseFormReturn<IntentionForm>;
  edited: IntentionRow | null;
  rows: readonly IntentionRow[];
  error: string | undefined;
}) {
  const mix = form.watch("mix");
  const choice = mixChoiceOf(mix, false);
  const trackers =
    edited === null ? [] : rows.filter((row) => row.intention.tracksMixOf === edited.intention.id);
  if (choice.kind === "track" && trackers.length > 0) {
    const owner = rows.find((row) => row.intention.id === choice.ownerId)?.intention;
    return (
      <div className="grid gap-1">
        <label
          htmlFor={`${id}-move`}
          className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs"
        >
          <Checkbox
            id={`${id}-move`}
            checked={form.watch("isMovingTrackers")}
            onCheckedChange={(checked) =>
              form.setValue("isMovingTrackers", checked === true, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
          <span>
            <b className="font-semibold">Move the {trackers.length} that track it along</b> —{" "}
            {trackers.map((row) => row.intention.name).join(", ")}. They would track {owner?.name}{" "}
            too.{" "}
            <span className="text-muted-foreground">
              Without this it cannot switch: that would make a chain.
            </span>
          </span>
        </label>
        <FieldError message={error} />
      </div>
    );
  }

  if (choice.kind === "copy") {
    return (
      <p className="text-xs text-muted-foreground">
        {edited !== null && !edited.mix.isOwn
          ? "Detaching: it gets a copy of the mix as it is now. Nothing changes for anyone else."
          : "A copy of the mix as it is now, edited on its own in Categories."}
      </p>
    );
  }

  return null;
}

const previewRequestOf = (
  values: IntentionForm,
  edited: IntentionRow | null,
): IntentionPreviewRequest | null => {
  const draft = draftOf(values);
  return values.countsFrom === "" || (draft.endsOn !== null && draft.endsOn < draft.countsFrom)
    ? null
    : {
        intentionId: edited?.intention.id ?? null,
        funding: draft.funding,
        scopeCategoryId: draft.scopeCategoryId,
        countsFrom: draft.countsFrom,
        endsOn: draft.endsOn,
        mix: draft.mix,
      };
};

// Where it lands, and what saving recounts over its whole window (§3), from the server.
function LandingNote({ values, edited }: { values: IntentionForm; edited: IntentionRow | null }) {
  const request = previewRequestOf(values, edited);
  const { data: preview } = useQuery({
    queryKey: ["intention-preview", request],
    queryFn: () => previewIntention(request as IntentionPreviewRequest),
    enabled: request !== null,
    placeholderData: (previous) => previous,
  });
  if (request === null) {
    return null;
  }

  const target = pagesOf(values.targetPages);
  const where = target === null ? "track" : "target";
  const pace =
    target === null ? "" : request.endsOn === null ? " — no end, so no pace" : ", with a pace";
  const changes =
    edited === null || preview === undefined
      ? []
      : (
          [
            ["Planned", edited.plannedPages, preview.plannedPages],
            ["Delivered", edited.deliveredPages, preview.deliveredPages],
            ["Output", edited.outputPages, preview.outputPages],
          ] as const
        ).filter(([, before, after]) => before !== after);
  const isMixChanged =
    preview !== undefined && edited !== null && preview.mix.some((row) => row.before !== row.after);

  return (
    <div className="grid gap-2 rounded-md border border-dashed px-3 py-2 text-xs">
      <p>
        Lands in <b className="font-semibold">{columnTitles[where]}</b>
        {pace}.
        {edited !== null && changes.length === 0 && preview !== undefined && (
          <span className="text-muted-foreground"> Its counts do not change.</span>
        )}
      </p>
      {changes.length > 0 && (
        <div className="text-tone-amber-foreground">
          <b className="font-semibold">Saving recounts it, over its whole window:</b>
          {changes.map(([label, before, after]) => (
            <div key={label}>
              {label}: {formatCount(before)} → <b className="font-semibold">{formatCount(after)}</b>{" "}
              pp
            </div>
          ))}
        </div>
      )}
      {isMixChanged && preview !== undefined && (
        <table className="w-full max-w-sm text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left font-normal">Mix within the scope</th>
              <th className="text-right font-normal">Now</th>
              <th className="text-right font-normal">After</th>
            </tr>
          </thead>
          <tbody>
            {preview.mix.map((row) => (
              <tr key={row.categoryId}>
                <td>{row.name}</td>
                <td className="text-right tabular-nums">{shareTextOf(row.before)}</td>
                <td
                  className={cn(
                    "text-right tabular-nums",
                    row.before !== row.after && "font-semibold",
                  )}
                >
                  {shareTextOf(row.after)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- delete

interface DeleteIntentionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  row: IntentionRow;
  onDeleted: () => void;
}

// Nothing is attached, so nothing moves; what was generated with it keeps that in its history.
export function DeleteIntentionDialog({
  isOpen,
  onClose,
  row,
  onDeleted,
}: DeleteIntentionDialogProps) {
  const { intention } = row;
  const { data: deletion } = useQuery({
    queryKey: ["intention-deletion", intention.id],
    queryFn: () => previewIntentionDeletion(intention.id),
    enabled: isOpen,
  });
  const remove = useActionMutation({
    call: deleteIntention,
    invalidates: intentionInvalidations,
    refusalTexts,
  });
  const generated = deletion?.generatedLists ?? [];

  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Delete ${intention.name}?`}
      description="Delete an intention; nothing attached to it moves, since nothing is."
      consequences={
        deletion === undefined
          ? undefined
          : [
              {
                text: "Nothing is attached to an intention, so no list changes and no item moves.",
              },
              ...(generated.length === 0
                ? []
                : [
                    {
                      text: `${plural(generated.length, "list was", "lists were")} generated with it (${generated.map((list) => list.name).join(", ")}); ${generated.length === 1 ? "its" : "their"} history keeps that, with the mix as it was then.`,
                    },
                  ]),
              ...(intention.archived === null
                ? [
                    {
                      text: "Archive it instead if you only want it off the page: archiving keeps its result.",
                      tone: "amber" as const,
                    },
                  ]
                : []),
            ]
      }
      confirmLabel="Delete"
      isDestructive
      onConfirm={async () => {
        const result = await remove.run(intention.id);
        if (result.isDone) {
          onDeleted();
        }

        return result;
      }}
    />
  );
}

// ---------------------------------------------------------------- repeats

const templateFormSchema = z.object({
  namePattern: z
    .string()
    .trim()
    .includes("{period}", { message: "Put {period} in the name, so each one is told apart" }),
  every: repeatEverySchema,
  funding: z.string(),
  scope: z.string(),
  tracksMixOf: z.string().min(1, "Pick the mix its occurrences track"),
  targetPages: z.string().regex(pagesText, "A target is a number of pages, or none"),
  isArchivingPrevious: z.boolean(),
});
type TemplateForm = z.infer<typeof templateFormSchema>;

const templateDraftOf = (values: TemplateForm): IntentionTemplateDraft => ({
  namePattern: values.namePattern.trim(),
  every: values.every,
  funding: fundingOf(values.funding),
  scopeCategoryId: values.scope === allCategories ? null : values.scope,
  tracksMixOf: values.tracksMixOf,
  targetPages: pagesOf(values.targetPages),
  isArchivingPrevious: values.isArchivingPrevious,
});

interface TemplateFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // None makes a new one.
  row: IntentionTemplateRow | null;
  rows: readonly IntentionRow[];
  session: Session;
}

// Each period gets its own intention, nothing is reset; editing changes only those to come.
export function TemplateFormDialog({
  isOpen,
  onClose,
  row,
  rows,
  session,
}: TemplateFormDialogProps) {
  const id = useId();
  const template = row?.template ?? null;
  const overall = rows.find((candidate) => candidate.intention.isOverall)?.intention;
  const madeCount =
    template === null
      ? 0
      : rows.filter((candidate) => candidate.intention.templateId === template.id).length;
  const save = useActionMutation({
    call: (draft: IntentionTemplateDraft) =>
      template === null
        ? createIntentionTemplate(draft)
        : saveIntentionTemplate(template.id, draft),
    invalidates: intentionInvalidations,
    refusalTexts: { 403: "You may no longer set repeats." },
  });

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={template === null ? "New repeat" : `Edit repeat — ${template.namePattern}`}
      description="A repeat makes one intention per period, each with its own window and progress."
      schema={templateFormSchema}
      defaultValues={{
        namePattern: template?.namePattern ?? "",
        every: template?.every ?? "month",
        funding: template === null ? fundingAny : fundingValueOf(template.funding),
        scope: template?.scopeCategoryId ?? allCategories,
        tracksMixOf: template?.tracksMixOf ?? overall?.id ?? "",
        targetPages:
          template === null || template.targetPages === null ? "" : String(template.targetPages),
        isArchivingPrevious: template?.isArchivingPrevious ?? true,
      }}
      submitLabel={template === null ? "Create repeat" : "Save"}
      onSubmit={(values) => save.run(templateDraftOf(values))}
      render={(form) => {
        const values = form.watch();
        const touched = { shouldDirty: true } as const;
        return (
          <>
            <Field id={`${id}-name`} label="Name" hint="{period} becomes e.g. July 2026">
              <Input
                id={`${id}-name`}
                placeholder="e.g. Monthly output — {period}"
                {...form.register("namePattern")}
              />
            </Field>
            <FieldError message={form.formState.errors.namePattern?.message} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${id}-every`} label="Every">
                <Select
                  value={values.every}
                  onValueChange={(value) =>
                    form.setValue("every", repeatEverySchema.parse(value), touched)
                  }
                >
                  <SelectTrigger id={`${id}-every`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {repeatEverySchema.options.map((every) => (
                      <SelectItem key={every} value={every}>
                        {everyLabels[every]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id={`${id}-target`} label="Target pages" hint="none: it tracks the mix">
                <Input
                  id={`${id}-target`}
                  inputMode="numeric"
                  placeholder="e.g. 3,000"
                  {...form.register("targetPages")}
                />
              </Field>
            </div>
            <FieldError message={form.formState.errors.targetPages?.message} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${id}-funding`} label="Funding">
                <FundingSelect
                  id={`${id}-funding`}
                  value={values.funding}
                  session={session}
                  onChange={(value) => form.setValue("funding", value, touched)}
                />
              </Field>
              <Field id={`${id}-scope`} label="Categories">
                <ScopeSelect
                  id={`${id}-scope`}
                  value={values.scope}
                  onChange={(value) => form.setValue("scope", value, touched)}
                />
              </Field>
            </div>
            <Field id={`${id}-mix`} label="Mix" hint="each occurrence tracks it">
              <Select
                value={values.tracksMixOf}
                onValueChange={(value) => form.setValue("tracksMixOf", value, touched)}
              >
                <SelectTrigger id={`${id}-mix`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ownersOf(rows).map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      Track {owner.name}
                      {owner.isOverall && " (Overall)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label htmlFor={`${id}-archive`} className="flex items-start gap-2 text-sm">
              <Checkbox
                id={`${id}-archive`}
                checked={values.isArchivingPrevious}
                onCheckedChange={(checked) =>
                  form.setValue("isArchivingPrevious", checked === true, touched)
                }
              />
              <span>
                Archive the previous one when the next is made{" "}
                <span className="text-muted-foreground">
                  — it only leaves the page; its result stays
                </span>
              </span>
            </label>
            <p className="text-xs text-muted-foreground">
              Each period gets its own intention, with its own window and progress — nothing is
              reset.
              {madeCount > 0 &&
                ` Changes apply from the next one; the ${madeCount} already made keep their definition — edit them one by one.`}
            </p>
          </>
        );
      }}
    />
  );
}
