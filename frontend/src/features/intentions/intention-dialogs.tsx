// What is done to an intention and to a repeat (intentions.md §2.1–§2.2, §3, §3.3; flows.md M1–
// M4; page-intentions.js modals). One editor makes a new intention, edits one, and makes a new one
// from an old one, since the counting start is fixed once created. Its one mix field chooses no
// mix, the Primary mix, or a mix by its latest or a labelled revision (PLAN-mix, PLAN-no-mix).
// Before saving it says where the intention lands, what saving recounts and the percentages it would read
// beside the ones it reads now, all from the server's preview. Deleting says what was generated
// with it; a repeat changes only the occurrences still to come. A correcting run shows the
// allocation it would hand to the list editor before anything is generated.
import { useQuery } from "@tanstack/react-query";
import type {
  IntentionDraft,
  IntentionPreviewRequest,
  IntentionRow,
  IntentionTemplateDraft,
  IntentionTemplateRow,
  MixChoice,
} from "@vera/contract/intentions";
import type { Category, IntentionFunding, Project, Session } from "@vera/domain/entities";
import { repeatEverySchema } from "@vera/domain/entities";
import { mixBand } from "@vera/domain/intentions";
import { can } from "@vera/domain/permissions";
import { scopeOfProject } from "@vera/domain/projects";
import { propertyConditionSchema } from "@vera/domain/properties";
import { useId, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Link } from "react-router";
import { z } from "zod";
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
import { CompactTable } from "@/components/compact-table";
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
import { everyLabels, shareTextOf } from "@/features/intentions/intentions-view";
import { intentionInvalidations } from "@/features/intentions/use-intentions-query";
import {
  ScopeConditionsField,
  savedConditionsOf,
} from "@/features/properties/scope-conditions-field";
import type { Refusal } from "@/hooks/use-action-mutation";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useCategoriesQuery, useProjectsQuery } from "@/hooks/use-reference-query";
import { i18n } from "@/i18n";
import { formatCalendarDay, formatLongCalendarDay } from "@/lib/format-date";
import { formatCount, formatPageUnit } from "@/lib/format-number";
import { cn } from "@/lib/utils";

const message = (key: string, options?: Record<string, unknown>) =>
  i18n.t(key, {
    ns:
      key.startsWith("categoriesPage.") ||
      key.startsWith("categoryPane.") ||
      key.startsWith("categoryDialog.")
        ? "categories"
        : "intentions",
    ...options,
  });
const refusalTexts = () => ({
  "intention.name": message("intentionDialog.nameTaken"),
  "intention.counts_from": message("intentionDialog.fixedStart"),
  "intention.project": message("intentionDialog.projectOwn"),
  403: message("intentionDialog.forbidden"),
});

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
          <SelectItem value={fundingAny}>{message("intentionDialog.allWork")}</SelectItem>
        )}
        {(canUnscoped || value === fundingNone) && (
          <SelectItem value={fundingNone}>{message("intentionDialog.noProject")}</SelectItem>
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
        <SelectItem value={allCategories}>{message("categoriesPage.allCategories")}</SelectItem>
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
        <SelectItem value="none">{message("intentionDialog.noMixOutputOnly")}</SelectItem>
        <SelectItem value="primary">{message("intentionDialog.usePrimary")}</SelectItem>
        {mixes
          .filter((mix) => mix.archivedAt === null)
          .map((mix) => (
            <SelectItem key={`use:${mix.id}`} value={`use:${mix.id}`}>
              {message("intentionDialog.followLatest", {
                name: mix.name,
                primary: mix.isPrimary ? ` (${message("intentionDialog.primary")})` : "",
              })}
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
                  {message("intentionDialog.useSnapshot", {
                    label: revision.label,
                    name: mix.name,
                  })}
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

const intentionFormSchemaOf = () =>
  z
    .object({
      name: z.string().trim().min(1, message("intentionDialog.nameRequired")),
      description: z.string(),
      funding: z.string(),
      scope: z.string(),
      mix: z.string(),
      targetPages: z.string().regex(pagesText, message("intentionDialog.targetPagesError")),
      countsFrom: z.string().min(1, message("intentionDialog.countsFromRequired")),
      endsOn: z.string(),
      // PLAN-scope: conditions on the items' properties.
      conditions: z.array(propertyConditionSchema),
    })
    .refine((values) => values.endsOn === "" || values.endsOn >= values.countsFrom, {
      message: message("intentionDialog.endBeforeStart"),
      path: ["endsOn"],
    });
type IntentionForm = z.infer<ReturnType<typeof intentionFormSchemaOf>>;

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
    name: isCopy ? message("intentionDialog.copyName", { name: intention.name }) : intention.name,
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
    refusalTexts: refusalTexts(),
  });
  const title =
    source.kind === "new"
      ? message("intentionsPage.newIntention")
      : source.kind === "copy"
        ? message("intentionDialog.copyTitle", { name: source.row.intention.name })
        : message("intentionDialog.editTitle", { name: source.row.intention.name });
  const schema = intentionFormSchemaOf();

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={message("intentionDialog.formDescription")}
      schema={schema}
      defaultValues={defaultsOf(source)}
      submitLabel={
        edited === null ? message("intentionDialog.create") : message("intentionDialog.save")
      }
      secondary={
        onDelete === undefined
          ? undefined
          : { label: message("intentionDialog.delete"), isDestructive: true, onSelect: onDelete }
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
              <Field id={`${id}-name`} label={message("categoryDialog.name")}>
                <Input
                  id={`${id}-name`}
                  placeholder={message("intentionDialog.namePlaceholder")}
                  {...form.register("name")}
                />
              </Field>
              <FieldError message={form.formState.errors.name?.message} />
            </>
          ) : (
            <p className="rounded-md bg-tone-blue px-3 py-2 text-ui text-tone-blue-foreground">
              {message("intentionDialog.ownProjectNote", { name: ownProject.name })}{" "}
              <Link
                to={`/projects/${encodeURIComponent(ownProject.id)}`}
                className="font-medium underline underline-offset-2"
              >
                {message("intentionDialog.changeThere")}
              </Link>
              {message("intentionDialog.scopeMixHere")}
            </p>
          )}
          <Field
            id={`${id}-description`}
            label={message("intentionDialog.description")}
            hint={message("intentionDialog.optional")}
          >
            <Textarea id={`${id}-description`} rows={2} {...form.register("description")} />
          </Field>
          {edited !== null && isOverall ? (
            <div className="space-y-3">
              <OverallNote row={edited} />
              <Field id={`${id}-mix`} label={message("intentionDialog.compareOutputMix")}>
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
      {message("intentionDialog.overallNote", {
        date: formatLongCalendarDay(row.intention.countsFrom),
      })}
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
          <Field
            id={`${id}-scope`}
            label={message("intentionDialog.categories")}
            hint={message("intentionDialog.oneSubtree")}
          >
            <ScopeSelect
              id={`${id}-scope`}
              value={values.scope}
              onChange={(value) => form.setValue("scope", value, touched)}
            />
          </Field>
          <Field id={`${id}-mix`} label={message("intentionDialog.mix")}>
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
          {message("intentionDialog.windowSummary", {
            from: formatCalendarDay(intention.countsFrom),
            to:
              intention.endsOn === null
                ? message("intentionDialog.noEnd")
                : formatCalendarDay(intention.endsOn),
            target:
              intention.targetPages === null
                ? message("intentionDialog.noTarget")
                : message("intentionDialog.targetValue", {
                    count: formatCount(intention.targetPages),
                  }),
          })}
        </p>
        <LandingNote values={values} edited={edited} />
      </>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-funding`} label={message("intentions:filter.project")}>
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
        <Field
          id={`${id}-scope`}
          label={message("intentionDialog.categories")}
          hint={message("intentionDialog.oneSubtree")}
        >
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
        <Field id={`${id}-mix`} label={message("intentionDialog.mix")}>
          <MixSelect
            id={`${id}-mix`}
            value={values.mix}
            onChange={(value) => form.setValue("mix", value, touched)}
          />
        </Field>
        <Field
          id={`${id}-target`}
          label={message("intentionDialog.targetPages")}
          hint={message("intentionDialog.targetHint")}
        >
          <Input
            id={`${id}-target`}
            inputMode="numeric"
            placeholder={message("intentionDialog.pagesPlaceholder")}
            {...form.register("targetPages")}
          />
        </Field>
      </div>
      <FieldError message={errors.targetPages?.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        {edited === null ? (
          <Field
            id={`${id}-from`}
            label={message("intentionDialog.countsFrom")}
            hint={message("intentionDialog.fixedOnceCreated")}
          >
            <Input id={`${id}-from`} type="date" {...form.register("countsFrom")} />
          </Field>
        ) : (
          <div className="grid gap-1.5 text-sm">
            <span className="font-medium">{message("intentionDialog.countsFrom")}</span>
            <span>
              {formatLongCalendarDay(edited.intention.countsFrom)}{" "}
              <span className="text-muted-foreground">· {message("intentionDialog.fixed")}</span>
            </span>
            {onCopy !== undefined && (
              <button
                type="button"
                className="text-left text-xs text-primary underline-offset-2 hover:underline"
                onClick={onCopy}
              >
                {message("intentionDialog.countFromAnother")}
              </button>
            )}
          </div>
        )}
        <Field
          id={`${id}-ends`}
          label={message("intentionDialog.ends")}
          hint={message("intentionDialog.emptyNoEnd")}
        >
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
  const where = target === null ? message("column.output") : message("column.targets");
  const pace =
    target === null
      ? ""
      : request.endsOn === null
        ? message("intentionDialog.noPace")
        : message("intentionDialog.withPace");
  const changes =
    edited === null || preview === undefined
      ? []
      : (
          [
            [message("intentionCard.planned"), edited.plannedPages, preview.plannedPages],
            [message("intentionCard.delivered"), edited.deliveredPages, preview.deliveredPages],
            [message("intentionCard.output"), edited.outputPages, preview.outputPages],
          ] as const
        ).filter(([, before, after]) => before !== after);
  const isMixChanged =
    preview !== undefined && edited !== null && preview.mix.some((row) => row.before !== row.after);

  return (
    <div className="grid gap-2 rounded-md border border-dashed px-3 py-2 text-xs">
      <p>
        {message("intentionDialog.landsIn", { column: where })}
        {pace}.
        {edited !== null && changes.length === 0 && preview !== undefined && (
          <span className="text-muted-foreground">
            {" "}
            {message("intentionDialog.countsUnchanged")}
          </span>
        )}
      </p>
      {changes.length > 0 && (
        <div className="text-tone-amber-foreground">
          <b className="font-semibold">{message("intentionDialog.savingRecounts")}</b>
          {changes.map(([label, before, after]) => (
            <div key={label}>
              {label}: {formatCount(before)} → <b className="font-semibold">{formatCount(after)}</b>{" "}
              {formatPageUnit()}
            </div>
          ))}
        </div>
      )}
      {isMixChanged && preview !== undefined && (
        <CompactTable
          rows={preview.mix}
          rowKey={(row) => row.categoryId}
          className="max-w-sm"
          columns={[
            {
              key: "name",
              header: message("intentionDialog.mixWithinScope"),
              cell: (row) => row.name,
            },
            {
              key: "before",
              header: message("intentionDialog.now"),
              align: "end",
              cell: (row) => shareTextOf(row.before),
            },
            {
              key: "after",
              header: message("intentionDialog.after"),
              align: "end",
              cell: (row) => (
                <span className={cn(row.before !== row.after && "font-semibold")}>
                  {shareTextOf(row.after)}
                </span>
              ),
            },
          ]}
        />
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
    refusalTexts: refusalTexts(),
  });
  const generated = deletion?.generatedLists ?? [];

  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={message("intentionDialog.deleteTitle", { name: intention.name })}
      description={message("intentionDialog.deleteDescription")}
      consequences={
        deletion === undefined
          ? undefined
          : [
              {
                text: message("intentionDialog.deleteNothingAttached"),
              },
              ...(generated.length === 0
                ? []
                : [
                    {
                      text: message("intentionDialog.generatedLists", {
                        count: generated.length,
                        names: generated.map((list) => list.name).join(", "),
                      }),
                    },
                  ]),
              ...(intention.archived === null
                ? [
                    {
                      text: message("intentionDialog.archiveInstead"),
                      tone: "amber" as const,
                    },
                  ]
                : []),
            ]
      }
      confirmLabel={message("intentionDialog.delete")}
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

const templateFormSchemaOf = () =>
  z.object({
    namePattern: z
      .string()
      .trim()
      .includes("{period}", { message: message("intentionDialog.periodRequired") }),
    every: repeatEverySchema,
    funding: z.string(),
    scope: z.string(),
    mix: z.string(),
    targetPages: z.string().regex(pagesText, message("intentionDialog.targetPagesError")),
    isArchivingPrevious: z.boolean(),
    conditions: z.array(propertyConditionSchema),
  });
type TemplateForm = z.infer<ReturnType<typeof templateFormSchemaOf>>;

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
  const schema = templateFormSchemaOf();
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
    refusalTexts: { 403: message("intentionDialog.forbiddenRepeat") },
  });

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        template === null
          ? message("intentionsPage.newRepeat")
          : message("intentionDialog.editRepeat", { name: template.namePattern })
      }
      description={message("intentionDialog.repeatDescription")}
      schema={schema}
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
      submitLabel={
        template === null
          ? message("intentionDialog.createRepeat")
          : message("intentionDialog.save")
      }
      onSubmit={(values) => save.run(templateDraftOf(values))}
      render={(form) => {
        const values = form.watch();
        const touched = { shouldDirty: true } as const;
        return (
          <>
            <Field
              id={`${id}-name`}
              label={message("categoryDialog.name")}
              hint={message("intentionDialog.periodHint")}
            >
              <Input
                id={`${id}-name`}
                placeholder={message("intentionDialog.repeatNamePlaceholder")}
                {...form.register("namePattern")}
              />
            </Field>
            <FieldError message={form.formState.errors.namePattern?.message} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${id}-every`} label={message("intentionDialog.every")}>
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
                        {i18n.t(everyLabels[every])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                id={`${id}-target`}
                label={message("intentionDialog.targetPages")}
                hint={message("intentionDialog.targetHint")}
              >
                <Input
                  id={`${id}-target`}
                  inputMode="numeric"
                  placeholder={message("intentionDialog.repeatPagesPlaceholder")}
                  {...form.register("targetPages")}
                />
              </Field>
            </div>
            <FieldError message={form.formState.errors.targetPages?.message} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${id}-funding`} label={message("intentionDialog.project")}>
                <ProjectScopeSelect
                  id={`${id}-funding`}
                  value={values.funding}
                  session={session}
                  onChange={(value) => form.setValue("funding", value, touched)}
                />
              </Field>
              <Field id={`${id}-scope`} label={message("intentionDialog.categories")}>
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
            <Field
              id={`${id}-mix`}
              label={message("intentionDialog.mix")}
              hint={message("intentionDialog.mixRepeatHint")}
            >
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
                {message("intentionDialog.archivePrevious")}{" "}
                <span className="text-muted-foreground">
                  — {message("intentionDialog.archivePreviousHint")}
                </span>
              </span>
            </label>
            <p className="text-xs text-muted-foreground">
              {message("intentionDialog.repeatHelp")}
              {madeCount > 0 &&
                ` ${message("intentionDialog.repeatChanges", { count: madeCount })}`}
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
      title={message("intentionDialog.correctTitle", { name: intention.name })}
      description={message("intentionDialog.correctDescription")}
      width="wide"
      primary={{
        label: message("intentionDialog.generateDraftAllocation"),
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
          {message("intentionDialog.correctionSummary", {
            scope: within,
            output: formatCount(row.outputPages),
            since: formatLongCalendarDay(intention.countsFrom),
          })}
        </p>
        <Field id={`${id}-pages`} label={message("intentionDialog.pagesForList")}>
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
              <CompactTable
                rows={preview.rows}
                rowKey={(row) => row.categoryId}
                columns={[
                  {
                    key: "name",
                    header: message(within === null ? "category.column" : "category.within", {
                      scope: within,
                    }),
                    cell: (row) => row.name,
                  },
                  {
                    key: "intended",
                    header: message("intentionCard.intended"),
                    align: "end",
                    cell: (row) =>
                      row.intended === null ? (
                        <span className="text-tone-amber-foreground">
                          {message("intentionCard.noShare")}
                        </span>
                      ) : (
                        shareTextOf(row.intended)
                      ),
                  },
                  {
                    key: "output",
                    header: message("intentionDialog.outputNow"),
                    align: "end",
                    isHiddenOnPhone: true,
                    cell: (row) => (row.output === null ? "—" : `${Math.round(row.output)}%`),
                  },
                  {
                    key: "new",
                    header: message("intentionDialog.newPages"),
                    align: "end",
                    cell: (row) => (
                      <span className="font-semibold">{formatCount(row.newPages)}</span>
                    ),
                  },
                  {
                    key: "after",
                    header: message("intentionDialog.after"),
                    align: "end",
                    cell: (correction) => {
                      const drift =
                        correction.intended === null
                          ? null
                          : Math.round(correction.after - correction.intended);
                      return (
                        <>
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
                        </>
                      );
                    },
                  },
                  {
                    key: "ready",
                    header: message("intentionDialog.ready"),
                    align: "end",
                    isHiddenOnPhone: true,
                    cell: (row) => (
                      <span
                        className={cn(
                          row.shortPages > 0 && "font-semibold text-tone-amber-foreground",
                        )}
                      >
                        {formatCount(row.readyPages)}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
            {preview.unallocated > 0.5 && (
              <p className="text-xs text-tone-amber-foreground">
                {message("intentionDialog.unallocatedCorrection", {
                  percent: Math.round(preview.unallocated),
                })}
              </p>
            )}
            {short.length > 0 && (
              <p className="rounded-md border border-tone-amber-foreground/30 bg-tone-amber px-3 py-2 text-xs text-tone-amber-foreground">
                <b className="font-semibold">{message("intentionDialog.short")}</b>{" "}
                {short
                  .map((correction) =>
                    message("intentionDialog.shortCategory", {
                      name: correction.name,
                      needed: formatCount(correction.newPages),
                      ready: formatCount(correction.readyPages),
                    }),
                  )
                  .join(" · ")}
                {message("intentionDialog.shortWarning")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {message("intentionDialog.correctionHelp", {
                cut: preview.isCut ? message("intentionDialog.cutProportion") : "",
              })}
            </p>
          </>
        )}
      </div>
    </DialogShell>
  );
}
