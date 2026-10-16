// What is done to an intention and to a repeat (intentions.md §2.1–§2.2, §3, §3.3; flows.md M1–
// M4; page-intentions.js modals). One editor makes a new intention, edits one, and makes a new one
// from an old one, since the counting start is fixed once created. Its one mix field chooses no
// mix, the Primary mix, or a mix by its latest or a labelled revision (PLAN-mix, PLAN-no-mix).
// Before saving it says where the intention lands, what saving recounts and the percentages it would read
// beside the ones it reads now, all from the server's preview. Deleting says what was generated
// with it; a repeat changes only the occurrences still to come. A correcting run shows the
// allocation it would hand to the list editor before anything is generated.
// TODO(rrandiak): labels move to i18n.

import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Link } from "react-router";
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
  previewCorrection,
  previewIntention,
  previewIntentionDeletion,
  saveIntention,
  saveIntentionTemplate,
} from "@/api/intentions";
import { listMixes } from "@/api/mix-catalog";
import { Field } from "@/components/classification-fields";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import { DialogShell } from "@/components/dialogs/dialog-shell";
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
import { mixBand } from "@/domain/intentions";
import { can } from "@/domain/permissions";
import { scopeOfProject } from "@/domain/projects";
import { propertyConditionSchema } from "@/domain/properties";
import { columnTitles, everyLabels, shareTextOf } from "@/features/intentions/intentions-view";
import { intentionInvalidations } from "@/features/intentions/use-intentions-query";
import {
  ScopeConditionsField,
  savedConditionsOf,
} from "@/features/properties/scope-conditions-field";
import type { Refusal } from "@/hooks/use-action-mutation";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useCategoriesQuery, useProjectsQuery } from "@/hooks/use-reference-query";
import { formatCalendarDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";

const refusalTexts = {
  "intention.name": "Another intention already has that name.",
  "intention.counts_from": "The counting start is fixed once created.",
  "intention.project":
    "Its name, project scope, window and target are its project's; change them there.",
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

// Unscoped choices only for whoever may set an unscoped intention; a named project for whoever
// may set intentions on it.
function ProjectScopeSelect({
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
          <SelectItem value={fundingAny}>All work — with or without a project</SelectItem>
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

// "none", "primary", "use:d2" or "use:d2:3", as the select holds it.
function mixChoiceOf(value: string): MixChoice {
  const [kind, mixId = "", revision] = value.split(":");
  if (kind === "use") return { kind: "use", mixId, revision: Number(revision) || null };
  return kind === "none" ? { kind: "none" } : { kind: "primary" };
}

function MixSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { data: mixes = [] } = useQuery({ queryKey: ["mixes"], queryFn: listMixes });
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No mix — count output only</SelectItem>
        <SelectItem value="primary">Use Primary mix</SelectItem>
        {mixes
          .filter((mix) => mix.archivedAt === null)
          .map((mix) => (
            <SelectItem key={`use:${mix.id}`} value={`use:${mix.id}`}>
              Follow latest: {mix.name}
              {mix.isPrimary ? " (Primary)" : ""}
            </SelectItem>
          ))}
        {mixes
          .filter((mix) => mix.archivedAt === null)
          .flatMap((mix) =>
            mix.revisions
              .filter((revision) => revision.label !== null)
              .map((revision) => (
                <SelectItem
                  key={`use:${mix.id}:${revision.revision}`}
                  value={`use:${mix.id}:${revision.revision}`}
                >
                  Use snapshot: {revision.label} · {mix.name}
                </SelectItem>
              )),
          )}
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
    targetPages: z.string().regex(pagesText, "A target is a number of pages, or none"),
    countsFrom: z.string().min(1, "Say when it starts counting"),
    endsOn: z.string(),
    // PLAN-scope: conditions on the items' properties.
    conditions: z.array(propertyConditionSchema),
  })
  .refine((values) => values.endsOn === "" || values.endsOn >= values.countsFrom, {
    message: "It cannot end before it starts counting",
    path: ["endsOn"],
  });
type IntentionForm = z.infer<typeof intentionFormSchema>;

const draftOf = (values: IntentionForm): IntentionDraft => ({
  name: values.name.trim(),
  description: values.description.trim(),
  funding: fundingOf(values.funding),
  scopeCategoryId: values.scope === allCategories ? null : values.scope,
  scopeConditions: savedConditionsOf(values.conditions),
  targetPages: pagesOf(values.targetPages),
  countsFrom: values.countsFrom,
  endsOn: values.endsOn === "" ? null : values.endsOn,
  mix: mixChoiceOf(values.mix),
});

function defaultsOf(source: IntentionSource): IntentionForm {
  if (source.kind === "new") {
    return {
      name: "",
      description: "",
      funding: fundingAny,
      scope: allCategories,
      mix: "primary",
      targetPages: "",
      countsFrom: "",
      endsOn: "",
      conditions: [],
    };
  }

  const { intention } = source.row;
  const isCopy = source.kind === "copy";
  // A new one from an old one reads the same mix and revision.
  const mixValue =
    intention.distributionId === null
      ? "none"
      : `use:${intention.distributionId}${intention.mixRevision ? `:${intention.mixRevision}` : ""}`;
  return {
    name: isCopy ? `${intention.name} (copy)` : intention.name,
    description: intention.description,
    funding: fundingValueOf(intention.funding),
    scope: intention.scopeCategoryId ?? allCategories,
    mix: mixValue,
    targetPages: intention.targetPages === null ? "" : String(intention.targetPages),
    countsFrom: isCopy ? "" : intention.countsFrom,
    endsOn: intention.endsOn ?? "",
    conditions: [...(intention.scopeConditions ?? [])],
  };
}

interface IntentionFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  source: IntentionSource;
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
  session,
  onSaved,
  onCopy,
  onDelete,
}: IntentionFormDialogProps) {
  const id = useId();
  const edited = source.kind === "edit" ? source.row : null;
  const isOverall = edited?.intention.isOverall === true;
  // A project's own: only its description, scope and mix are its own (intentions.md §3.4).
  const ownProject = edited?.intention.projectId === null ? null : (edited?.project ?? null);
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
      defaultValues={defaultsOf(source)}
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
      fieldOf={(refusal: Refusal) => (refusal.code === "intention.name" ? "name" : null)}
      render={(form) => (
        <>
          {ownProject === null ? (
            <>
              <Field id={`${id}-name`} label="Name">
                <Input
                  id={`${id}-name`}
                  placeholder="e.g. Regional weeklies 2027"
                  {...form.register("name")}
                />
              </Field>
              <FieldError message={form.formState.errors.name?.message} />
            </>
          ) : (
            <p className="rounded-md bg-tone-blue px-3 py-2 text-[0.8125rem] text-tone-blue-foreground">
              <b className="font-semibold">{ownProject.name}&apos;s own intention.</b> Its name,
              project scope, window and target are the project&apos;s:{" "}
              <Link
                to={`/projects/${encodeURIComponent(ownProject.id)}`}
                className="font-medium underline underline-offset-2"
              >
                change them there
              </Link>
              . Its category scope and optional mix can be changed here.
            </p>
          )}
          <Field id={`${id}-description`} label="Description" hint="optional">
            <Textarea id={`${id}-description`} rows={2} {...form.register("description")} />
          </Field>
          {edited !== null && isOverall ? (
            <div className="space-y-3">
              <OverallNote row={edited} />
              <Field id={`${id}-mix`} label="Compare output with mix">
                <MixSelect
                  id={`${id}-mix`}
                  value={form.watch("mix")}
                  onChange={(value) => form.setValue("mix", value, { shouldDirty: true })}
                />
              </Field>
            </div>
          ) : (
            <IntentionFields
              id={id}
              form={form}
              source={source}
              session={session}
              onCopy={onCopy}
              isProjectOwn={ownProject !== null}
            />
          )}
        </>
      )}
    />
  );
}

function OverallNote({ row }: { row: IntentionRow }) {
  return (
    <p className="text-xs text-muted-foreground">
      Overall counts everything from {formatCalendarDay(row.intention.countsFrom)}, with no target
      or end. Choosing a different mix changes this output comparison; it does not change which mix
      is Primary. Edit percentages in Mixes.
    </p>
  );
}

interface IntentionFieldsProps {
  id: string;
  form: UseFormReturn<IntentionForm>;
  source: IntentionSource;
  session: Session;
  onCopy: (() => void) | undefined;
  // Its project scope, window and target are its project's, shown, not edited.
  isProjectOwn: boolean;
}

function IntentionFields({
  id,
  form,
  source,
  session,
  onCopy,
  isProjectOwn,
}: IntentionFieldsProps) {
  const edited = source.kind === "edit" ? source.row : null;
  const values = form.watch();
  const { errors } = form.formState;
  const touched = { shouldDirty: true } as const;

  if (isProjectOwn && edited !== null) {
    const { intention } = edited;
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${id}-scope`} label="Categories" hint="one subtree">
            <ScopeSelect
              id={`${id}-scope`}
              value={values.scope}
              onChange={(value) => form.setValue("scope", value, touched)}
            />
          </Field>
          <Field id={`${id}-mix`} label="Mix">
            <MixSelect
              id={`${id}-mix`}
              value={values.mix}
              onChange={(value) => form.setValue("mix", value, touched)}
            />
          </Field>
        </div>
        <ScopeConditionsField
          id={`${id}-conditions`}
          value={values.conditions}
          onChange={(conditions) => form.setValue("conditions", conditions, touched)}
        />
        <p className="text-xs text-muted-foreground">
          Counts {formatCalendarDay(intention.countsFrom)} →{" "}
          {intention.endsOn === null ? "no end" : formatCalendarDay(intention.endsOn)} ·{" "}
          {intention.targetPages === null
            ? "no target"
            : `target ${formatCount(intention.targetPages)} pp`}
        </p>
        <LandingNote values={values} edited={edited} />
      </>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-funding`} label="Project">
          <ProjectScopeSelect
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
      <ScopeConditionsField
        id={`${id}-conditions`}
        value={values.conditions}
        onChange={(conditions) => form.setValue("conditions", conditions, touched)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-mix`} label="Mix">
          <MixSelect
            id={`${id}-mix`}
            value={values.mix}
            onChange={(value) => form.setValue("mix", value, touched)}
          />
        </Field>
        <Field id={`${id}-target`} label="Target pages" hint="none: it only counts output">
          <Input
            id={`${id}-target`}
            inputMode="numeric"
            placeholder="e.g. 4,000"
            {...form.register("targetPages")}
          />
        </Field>
      </div>
      <FieldError message={errors.targetPages?.message} />
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
        scopeConditions: draft.scopeConditions,
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
  mix: z.string(),
  targetPages: z.string().regex(pagesText, "A target is a number of pages, or none"),
  isArchivingPrevious: z.boolean(),
  conditions: z.array(propertyConditionSchema),
});
type TemplateForm = z.infer<typeof templateFormSchema>;

const templateDraftOf = (values: TemplateForm): IntentionTemplateDraft => ({
  namePattern: values.namePattern.trim(),
  every: values.every,
  funding: fundingOf(values.funding),
  scopeCategoryId: values.scope === allCategories ? null : values.scope,
  scopeConditions: savedConditionsOf(values.conditions),
  mix: mixChoiceOf(values.mix),
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
        mix:
          template === null
            ? "primary"
            : template.distributionId === null
              ? "none"
              : `use:${template.distributionId}${template.mixRevision ? `:${template.mixRevision}` : ""}`,
        targetPages:
          template === null || template.targetPages === null ? "" : String(template.targetPages),
        isArchivingPrevious: template?.isArchivingPrevious ?? true,
        conditions: [...(template?.scopeConditions ?? [])],
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
              <Field id={`${id}-target`} label="Target pages" hint="none: it only counts output">
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
              <Field id={`${id}-funding`} label="Project">
                <ProjectScopeSelect
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
            <ScopeConditionsField
              id={`${id}-conditions`}
              value={values.conditions}
              onChange={(conditions) => form.setValue("conditions", conditions, touched)}
            />
            <Field id={`${id}-mix`} label="Mix" hint="each occurrence keeps this selection">
              <MixSelect
                id={`${id}-mix`}
                value={values.mix}
                onChange={(value) => form.setValue("mix", value, touched)}
              />
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

// ---------------------------------------------------------------- a correcting run

interface CorrectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  row: IntentionRow;
  // Hands the accepted allocation to the list editor.
  onAccept: (pages: number, allocation: Record<string, number>) => void;
}

const correctionPagesOf = (typed: string) => {
  const digits = Number.parseInt(typed.replace(/\D/g, ""), 10);
  return Number.isNaN(digits) || digits <= 0 ? null : digits;
};

// The allocation that brings output back towards the mix, shown and accepted before anything is
// generated (STATUS "Intentions"). What the pool cannot cover stays short, and says so; moving
// those pages to another category is a decision, not a default.
export function CorrectionDialog({ isOpen, onClose, row, onAccept }: CorrectionDialogProps) {
  const id = useId();
  const { intention } = row;
  const [typed, setTyped] = useState("3000");
  const pages = correctionPagesOf(typed);
  const { data: preview } = useQuery({
    queryKey: ["intention-correction", intention.id, pages],
    queryFn: () => previewCorrection(intention.id, pages ?? 0),
    enabled: isOpen && pages !== null,
    placeholderData: (previous) => previous,
  });
  const within = row.scope === null ? null : (row.scope.path.at(-1) ?? null);
  const short = preview?.rows.filter((correction) => correction.shortPages > 0) ?? [];

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={onClose}
      title={`Correcting list — ${intention.name}`}
      description="The allocation a correcting list would take, before it is generated."
      width="wide"
      primary={{
        label: "Generate draft with this allocation",
        isDisabled: pages === null || preview === undefined,
        onSelect: () => {
          if (pages === null || preview === undefined) {
            return;
          }

          onAccept(
            pages,
            Object.fromEntries(
              preview.rows.map((correction) => [correction.categoryId, correction.newPages]),
            ),
          );
        },
      }}
    >
      <div className="grid gap-4">
        <p className="text-xs text-muted-foreground">
          Output{within === null ? "" : ` in ${within}`} so far:{" "}
          <b className="font-semibold text-foreground">{formatCount(row.outputPages)} pp</b> since{" "}
          {formatCalendarDay(intention.countsFrom)}. The new pages go where the output is short of
          the mix{within === null ? "" : ` within ${within}`}.
        </p>
        <Field id={`${id}-pages`} label="Pages for the list">
          <Input
            id={`${id}-pages`}
            inputMode="numeric"
            className="max-w-40"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </Field>
        {preview !== undefined && (
          <>
            <div>
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-1.5 text-left font-medium">
                      {within === null ? "Category" : `Within ${within}`}
                    </th>
                    <th className="text-right font-medium">Intended</th>
                    <th className="hidden text-right font-medium sm:table-cell">Output now</th>
                    <th className="text-right font-medium">New pages</th>
                    <th className="text-right font-medium">After</th>
                    <th className="hidden text-right font-medium sm:table-cell">Ready</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((correction) => {
                    const drift =
                      correction.intended === null
                        ? null
                        : Math.round(correction.after - correction.intended);
                    return (
                      <tr key={correction.categoryId} className="border-b last:border-0">
                        <td className="py-1.5">{correction.name}</td>
                        <td
                          className={cn(
                            "text-right tabular-nums",
                            correction.intended === null && "text-tone-amber-foreground",
                          )}
                        >
                          {correction.intended === null
                            ? "no share"
                            : shareTextOf(correction.intended)}
                        </td>
                        <td className="hidden text-right tabular-nums sm:table-cell">
                          {correction.output === null ? "—" : `${Math.round(correction.output)}%`}
                        </td>
                        <td className="text-right font-semibold tabular-nums">
                          {formatCount(correction.newPages)}
                        </td>
                        <td className="text-right tabular-nums">
                          {Math.round(correction.after)}%
                          {drift !== null && Math.abs(drift) > mixBand && (
                            <span
                              className={cn(
                                "ml-1 font-semibold",
                                drift > 0
                                  ? "text-tone-red-foreground"
                                  : "text-tone-blue-foreground",
                              )}
                            >
                              {drift > 0 ? "+" : ""}
                              {drift}
                            </span>
                          )}
                        </td>
                        <td
                          className={cn(
                            "hidden text-right tabular-nums sm:table-cell",
                            correction.shortPages > 0 && "font-semibold text-tone-amber-foreground",
                          )}
                        >
                          {formatCount(correction.readyPages)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {preview.unallocated > 0.5 && (
              <p className="text-xs text-tone-amber-foreground">
                {Math.round(preview.unallocated)}% of the mix is unallocated — nothing is drawn for
                it.
              </p>
            )}
            {short.length > 0 && (
              <p className="rounded-md border border-tone-amber-foreground/30 bg-tone-amber px-3 py-2 text-xs text-tone-amber-foreground">
                <b className="font-semibold">Short:</b>{" "}
                {short
                  .map(
                    (correction) =>
                      `${correction.name} needs ${formatCount(correction.newPages)} pp, ${formatCount(correction.readyPages)} are ready`,
                  )
                  .join(" · ")}
                . The draft stays short there and says so; it does not move those pages elsewhere.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Each category gets what it lacks against its share of the output plus these pages
              {preview.isCut ? ", cut in proportion because the gaps add up to more" : ""}. The
              draft is not saved, and the list counts towards whatever it matches — not towards this
              intention by being generated from it.
            </p>
          </>
        )}
      </div>
    </DialogShell>
  );
}
