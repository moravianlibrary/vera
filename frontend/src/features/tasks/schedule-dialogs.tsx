// What is asked before changing a schedule (docs/demos/shared/page-tasks.js `editSchedule`,
// `pause`; STATUS "Tasks"): the editor, with the plugin chosen once when the schedule is made,
// Repeat and its fields, what to do when the previous run is still going, and the next three runs
// it will get; *Delete schedule…* from the editor, saying its runs stay; and Pause, with the
// reason shown on the row so nobody resumes it too early.
// TODO(rrandiak): labels move to i18n.

import type { ScheduleRow } from "@vera/contract/schedules";
import {
  editableCadenceKinds,
  occurrencesOf,
  overlaps,
  schedulableKinds,
} from "@vera/domain/schedules";
import { useId } from "react";
import { createSchedule, deleteSchedule, pauseSchedule, saveSchedule } from "@/api/schedules";
import { Field } from "@/components/classification-fields";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { ReasonDialog } from "@/components/dialogs/reason-dialog";
import { FieldError } from "@/components/iteration-dialogs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaskNotice } from "@/features/tasks/run-dialogs";
import type { ScheduleForm } from "@/features/tasks/schedules-view";
import {
  cadenceKindLabels,
  cadenceOfForm,
  formOfCadence,
  scheduleFormSchema,
} from "@/features/tasks/schedules-view";
import { overlapLabels } from "@/features/tasks/task-words";
import { taskInvalidations } from "@/features/tasks/use-tasks-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { usePluginInstancesQuery } from "@/hooks/use-reference-query";
import { cadenceText, weekdayName } from "@/lib/format-cadence";
import { aheadText } from "@/lib/format-moment";
import { plural } from "@/lib/plural";

const refusalTexts = {
  "schedule.too_often": "Every 5 minutes is the shortest.",
  "schedule.not_schedulable": "That plugin runs only while somebody uses it.",
  "schedule.paused": "Somebody paused it meanwhile.",
  "schedule.not_paused": "Somebody resumed it meanwhile.",
  403: "You may no longer change schedules.",
} as const;

const overlapHints = {
  skip: "the next one catches up; right for refreshes",
  wait: "never miss one; right for sweeps",
} as const;

// Monday first, as a week is read here.
const weekdays = [1, 2, 3, 4, 5, 6, 0] as const;
const monthDays = Array.from({ length: 28 }, (_, index) => index + 1);
const previewDays = 100;

interface ScheduleEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // Edited; null for a new one.
  schedule: ScheduleRow | null;
  // The server's moment, which the next runs are counted from.
  asOf: string;
  onSaved: (row: ScheduleRow, notice: TaskNotice) => void;
  // Edit only.
  onDelete?: () => void;
}

export function ScheduleEditorDialog({
  isOpen,
  onClose,
  schedule,
  asOf,
  onSaved,
  onDelete,
}: ScheduleEditorDialogProps) {
  const id = useId();
  const { data: instances = [] } = usePluginInstancesQuery();
  const schedulable = instances.filter(
    (instance) =>
      instance.isEnabled && (schedulableKinds as readonly string[]).includes(instance.kind),
  );
  const instance = schedule?.source.kind === "plugin" ? schedule.source.instance : null;
  const save = useActionMutation({
    call: (form: ScheduleForm) => {
      const draft = { name: form.name, cadence: cadenceOfForm(form), overlap: form.overlap };
      return schedule === null
        ? createSchedule({ ...draft, instanceId: form.instanceId })
        : saveSchedule(schedule.id, draft);
    },
    invalidates: taskInvalidations,
    refusalTexts,
  });

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={schedule === null ? "New schedule" : `Edit schedule — ${schedule.name}`}
      description="When a plugin runs by itself"
      schema={scheduleFormSchema}
      defaultValues={{
        instanceId: instance?.id ?? "",
        name: schedule?.name ?? "",
        overlap: schedule?.overlap ?? "skip",
        ...formOfCadence(schedule?.cadence ?? { every: "day", at: "02:00" }),
      }}
      submitLabel={schedule === null ? "Create schedule" : "Save"}
      fieldOf={(refusal) => (refusal.code === "schedule.too_often" ? "interval" : null)}
      secondary={
        onDelete === undefined
          ? undefined
          : { label: "Delete schedule…", isDestructive: true, onSelect: onDelete }
      }
      onSubmit={async (form) => {
        const result = await save.run(form);
        if (result.isDone) {
          onSaved(result.value, {
            title: schedule === null ? "Schedule created" : "Schedule saved",
            text:
              result.value.nextAt === null
                ? `${result.value.name}.`
                : `${result.value.name}: next run ${aheadText(result.value.nextAt, asOf)}.`,
          });
        }

        return result;
      }}
      render={(form) => {
        const values = form.watch();
        const parsed = scheduleFormSchema.safeParse(values);
        const preview = parsed.success
          ? occurrencesOf(
              cadenceOfForm(parsed.data),
              new Date(Date.parse(asOf) + 1),
              new Date(Date.parse(asOf) + previewDays * 86_400_000),
              3,
            )
          : [];
        const errors = form.formState.errors;

        return (
          <>
            {schedule === null ? (
              <>
                <Field id={`${id}-instance`} label="Plugin instance">
                  <Select
                    value={values.instanceId}
                    onValueChange={(value) =>
                      form.setValue("instanceId", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger id={`${id}-instance`} className="w-full">
                      <SelectValue placeholder="Choose the plugin it runs" />
                    </SelectTrigger>
                    <SelectContent>
                      {schedulable.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.name} · {candidate.plugin}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <FieldError message={errors.instanceId?.message} />
              </>
            ) : (
              <p className="text-muted-foreground">
                Runs <b className="font-semibold text-foreground">{instance?.name}</b> ·{" "}
                {instance?.plugin}
              </p>
            )}

            <Field id={`${id}-name`} label="Name">
              <Input
                id={`${id}-name`}
                placeholder="e.g. MZK Aleph — catalog resync"
                {...form.register("name")}
              />
            </Field>
            <FieldError message={errors.name?.message} />

            <div className="grid gap-3 sm:grid-cols-3">
              <Field id={`${id}-every`} label="Repeat">
                <Select
                  value={values.every}
                  onValueChange={(value) =>
                    form.setValue(
                      "every",
                      editableCadenceKinds.find((kind) => kind === value) ?? "day",
                      {
                        shouldDirty: true,
                        shouldValidate: true,
                      },
                    )
                  }
                >
                  <SelectTrigger id={`${id}-every`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {editableCadenceKinds.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {cadenceKindLabels[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {(values.every === "minutes" || values.every === "hours") && (
                <Field id={`${id}-interval`} label="Every">
                  <Input
                    id={`${id}-interval`}
                    type="number"
                    min={1}
                    {...form.register("interval", { valueAsNumber: true })}
                  />
                </Field>
              )}
              {(values.every === "week" || values.every === "month") && (
                <Field id={`${id}-on`} label="On">
                  <Select
                    value={String(values.every === "week" ? values.weekday : values.day)}
                    onValueChange={(value) =>
                      form.setValue(values.every === "week" ? "weekday" : "day", Number(value), {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger id={`${id}-on`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {values.every === "week"
                        ? weekdays.map((weekday) => (
                            <SelectItem key={weekday} value={String(weekday)}>
                              {weekdayName(weekday)}
                            </SelectItem>
                          ))
                        : monthDays.map((day) => (
                            <SelectItem key={day} value={String(day)}>
                              day {day}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              {values.every !== "minutes" && values.every !== "hours" && (
                <Field id={`${id}-at`} label="At">
                  <Input id={`${id}-at`} type="time" {...form.register("at")} />
                </Field>
              )}
            </div>
            <FieldError message={errors.interval?.message ?? errors.at?.message} />

            <fieldset className="grid gap-2">
              <legend className="mb-1.5 text-sm font-medium">
                If the previous run is still going
              </legend>
              <RadioGroup
                value={values.overlap}
                onValueChange={(value) =>
                  form.setValue(
                    "overlap",
                    overlaps.find((overlap) => overlap === value) ?? "skip",
                    {
                      shouldDirty: true,
                    },
                  )
                }
              >
                {overlaps.map((overlap) => (
                  <div key={overlap} className="flex items-start gap-2">
                    <RadioGroupItem id={`${id}-${overlap}`} value={overlap} className="mt-0.5" />
                    <Label htmlFor={`${id}-${overlap}`} className="block leading-snug font-normal">
                      {overlapLabels[overlap]}
                      <span className="text-muted-foreground"> — {overlapHints[overlap]}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>

            <div className="grid gap-1">
              <span className="text-sm font-medium">Next runs</span>
              <p className="text-xs text-muted-foreground">
                {parsed.success ? (
                  <>
                    <span className="text-foreground">
                      {preview.map((at) => aheadText(at.toISOString(), asOf)).join(" · ")}
                    </span>{" "}
                    — {cadenceText(cadenceOfForm(parsed.data))}
                  </>
                ) : (
                  "Shown once the fields above are complete."
                )}
              </p>
            </div>
          </>
        );
      }}
    />
  );
}

interface PauseScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ScheduleRow;
  onPaused: (notice: TaskNotice) => void;
}

export function PauseScheduleDialog({
  isOpen,
  onClose,
  schedule,
  onPaused,
}: PauseScheduleDialogProps) {
  const pause = useActionMutation({
    call: (reason: string) => pauseSchedule(schedule.id, { reason }),
    invalidates: taskInvalidations,
    refusalTexts,
  });

  return (
    <ReasonDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Pause ${schedule.name}?`}
      description="Pausing a schedule"
      fields={
        <p className="text-sm">
          It stops running by itself until somebody resumes it. A run in progress finishes.
        </p>
      }
      internalNote={{
        label: "Why",
        hint: "shown on the schedule, so nobody resumes it too early",
        isRequired: true,
        placeholder: "e.g. catalog migration until 1 July",
      }}
      confirmLabel="Pause"
      isDestructive={false}
      onConfirm={async (texts) => {
        const result = await pause.run(texts.internalNote);
        if (result.isDone) {
          onPaused({ title: `Paused ${schedule.name}`, text: "Resume it from the same row." });
        }

        return result;
      }}
    />
  );
}

interface DeleteScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ScheduleRow;
  onDeleted: (notice: TaskNotice) => void;
}

export function DeleteScheduleDialog({
  isOpen,
  onClose,
  schedule,
  onDeleted,
}: DeleteScheduleDialogProps) {
  const remove = useActionMutation({
    call: () => deleteSchedule(schedule.id),
    invalidates: taskInvalidations,
    refusalTexts,
  });
  const instanceName =
    schedule.source.kind === "plugin" ? schedule.source.instance.name : schedule.name;

  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Delete ${schedule.name}?`}
      description="The schedule goes; its runs stay"
      consequences={[
        { text: `${instanceName} stops running by itself. It can still be run by hand.` },
        {
          text: `Its ${plural(schedule.runCount, "run")} on record stay, under retention like any other.`,
        },
        { text: "To stop it for a while, pause it instead.", tone: "amber" },
      ]}
      confirmLabel="Delete schedule"
      isDestructive
      onConfirm={async () => {
        const result = await remove.run(undefined);
        if (result.isDone) {
          onDeleted({
            title: "Schedule deleted",
            text: `${instanceName} runs only by hand now.`,
          });
        }

        return result;
      }}
    />
  );
}
