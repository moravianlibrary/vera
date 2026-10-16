// What is asked before acting on runs (docs/demos/shared/page-tasks.js `cancel`, `retention`):
// cancelling a run says where it stands and what stops, from the run as the server last counted
// it; how long runs are kept is two numbers, failed and cancelled ones at least as long as the
// rest. Running a run again asks nothing: the old run stays as it was.
// TODO(rrandiak): labels move to i18n.

import type { Retention, Run } from "@vera/contract/tasks";
import { retentionSchema } from "@vera/contract/tasks";
import { useId } from "react";
import type { z } from "zod";
import { cancelRun, saveRetention } from "@/api/tasks";
import { Field } from "@/components/classification-fields";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { FieldError } from "@/components/iteration-dialogs";
import { Input } from "@/components/ui/input";
import { taskInvalidations } from "@/features/tasks/use-tasks-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { formatCount } from "@/lib/format-number";

// Done, and what to say on the page about it.
export interface TaskNotice {
  title: string;
  text: string;
  // The run it started, to open.
  runId?: string;
}

interface CancelRunDialogProps {
  isOpen: boolean;
  onClose: () => void;
  run: Run;
  // Who started it, when it was another person; VERA's own runs have nobody to tell.
  otherStarter: string | null;
  onCancelled: (notice: TaskNotice) => void;
}

export function CancelRunDialog({
  isOpen,
  onClose,
  run,
  otherStarter,
  onCancelled,
}: CancelRunDialogProps) {
  const cancel = useActionMutation({
    call: () => cancelRun(run.id),
    invalidates: taskInvalidations,
    refusalTexts: {
      "task.not_running": "It has finished meanwhile.",
      403: "You may no longer cancel this run.",
    },
  });
  const left = run.itemCount - run.doneCount;

  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Cancel ${run.id}?`}
      description={run.what}
      consequences={[
        {
          text: `${run.what}: ${formatCount(run.doneCount)} of ${formatCount(run.itemCount)} processed.`,
        },
        {
          text: `It stops after the item it is on. What it already changed stays; the other ${formatCount(left)} are not processed.`,
        },
        ...(otherStarter === null
          ? []
          : [
              {
                text: `${otherStarter} started it, and sees it as cancelled by you.`,
                tone: "amber" as const,
              },
            ]),
      ]}
      confirmLabel="Cancel the run"
      cancelLabel="Keep running"
      isDestructive
      onConfirm={async () => {
        const result = await cancel.run(undefined);
        if (result.isDone) {
          onCancelled({
            title: `Cancelled ${run.id}`,
            text: `${formatCount(result.value.doneCount)} of ${formatCount(result.value.itemCount)} processed.`,
          });
        }

        return result;
      }}
    />
  );
}

const retentionFormSchema = retentionSchema.refine((form) => form.failedDays >= form.days, {
  path: ["failedDays"],
  message: "Keep failed and cancelled runs at least as long as the others.",
});

interface RetentionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  retention: Retention;
  onSaved: (notice: TaskNotice) => void;
}

export function RetentionDialog({ isOpen, onClose, retention, onSaved }: RetentionDialogProps) {
  const id = useId();
  const save = useActionMutation({
    call: saveRetention,
    invalidates: taskInvalidations,
    refusalTexts: {
      "retention.failed_shorter": "Keep failed and cancelled runs at least as long as the others.",
      403: "You may no longer change how long runs are kept.",
    },
  });

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Keep runs for"
      description="How long a run's account is kept"
      schema={retentionFormSchema satisfies z.ZodType<Retention, Retention>}
      defaultValues={retention}
      submitLabel="Save"
      fieldOf={(refusal) => (refusal.code === "retention.failed_shorter" ? "failedDays" : null)}
      onSubmit={async (form) => {
        const result = await save.run(form);
        if (result.isDone) {
          onSaved({
            title: "Saved",
            text: `Runs are kept ${result.value.days} days, failed and cancelled ones ${result.value.failedDays} days.`,
          });
        }

        return result;
      }}
      render={(form) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={`${id}-days`} label="Runs, days">
              <Input
                id={`${id}-days`}
                type="number"
                min={7}
                {...form.register("days", { valueAsNumber: true })}
              />
            </Field>
            <Field id={`${id}-failed`} label="Failed and cancelled, days">
              <Input
                id={`${id}-failed`}
                type="number"
                min={7}
                {...form.register("failedDays", { valueAsNumber: true })}
              />
            </Field>
          </div>
          <FieldError
            message={
              form.formState.errors.days?.message ?? form.formState.errors.failedDays?.message
            }
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            A run older than this is removed with its log and items. What it changed stays in each
            record&apos;s own history; only the account of the run goes.
          </p>
        </>
      )}
    />
  );
}
