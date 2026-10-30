// What is asked before acting on runs (docs/demos/shared/page-tasks.js `cancel`, `retention`):
// cancelling a run says where it stands and what stops, from the run as the server last counted
// it; how long runs are kept is two numbers, failed and cancelled ones at least as long as the
// rest. Running a run again asks nothing: the old run stays as it was.

import type { Retention, Run } from "@vera/contract/tasks";
import { retentionSchema } from "@vera/contract/tasks";
import { useId } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("tasks");
  const cancel = useActionMutation({
    call: () => cancelRun(run.id),
    invalidates: taskInvalidations,
    refusalTexts: {
      "task.not_running": t("runDialogs.refusalNotRunning"),
      403: t("runDialogs.refusalCancelForbidden"),
    },
  });
  const left = run.itemCount - run.doneCount;

  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("runDialogs.cancelTitle", { id: run.id })}
      description={run.what}
      consequences={[
        {
          text: t("runDialogs.cancelProgress", {
            what: run.what,
            done: formatCount(run.doneCount),
            total: formatCount(run.itemCount),
          }),
        },
        {
          text: t("runDialogs.cancelConsequence", { left: formatCount(left) }),
        },
        ...(otherStarter === null
          ? []
          : [
              {
                text: t("runDialogs.cancelOtherStarter", { name: otherStarter }),
                tone: "amber" as const,
              },
            ]),
      ]}
      confirmLabel={t("runDialogs.cancelRun")}
      cancelLabel={t("runDialogs.keepRunning")}
      isDestructive
      onConfirm={async () => {
        const result = await cancel.run(undefined);
        if (result.isDone) {
          onCancelled({
            title: t("runDialogs.cancelledTitle", { id: run.id }),
            text: t("runDialogs.processed", {
              done: formatCount(result.value.doneCount),
              total: formatCount(result.value.itemCount),
            }),
          });
        }

        return result;
      }}
    />
  );
}

const retentionFormSchema = (message: string) =>
  retentionSchema.refine((form) => form.failedDays >= form.days, {
    path: ["failedDays"],
    message,
  });

interface RetentionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  retention: Retention;
  onSaved: (notice: TaskNotice) => void;
}

export function RetentionDialog({ isOpen, onClose, retention, onSaved }: RetentionDialogProps) {
  const { t } = useTranslation("tasks");
  const id = useId();
  const save = useActionMutation({
    call: saveRetention,
    invalidates: taskInvalidations,
    refusalTexts: {
      "retention.failed_shorter": t("runDialogs.retentionOrder"),
      403: t("runDialogs.retentionForbidden"),
    },
  });

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("runDialogs.keepRunsFor")}
      description={t("runDialogs.retentionDescription")}
      schema={
        retentionFormSchema(t("runDialogs.retentionOrder")) satisfies z.ZodType<
          Retention,
          Retention
        >
      }
      defaultValues={retention}
      submitLabel={t("runDialogs.save")}
      fieldOf={(refusal) => (refusal.code === "retention.failed_shorter" ? "failedDays" : null)}
      onSubmit={async (form) => {
        const result = await save.run(form);
        if (result.isDone) {
          onSaved({
            title: t("runDialogs.saved"),
            text: t("runDialogs.retentionSaved", {
              days: result.value.days,
              failedDays: result.value.failedDays,
            }),
          });
        }

        return result;
      }}
      render={(form) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={`${id}-days`} label={t("runDialogs.runDays")}>
              <Input
                id={`${id}-days`}
                type="number"
                min={7}
                {...form.register("days", { valueAsNumber: true })}
              />
            </Field>
            <Field id={`${id}-failed`} label={t("runDialogs.failedDays")}>
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
            {t("runDialogs.retentionFinePrint")}
          </p>
        </>
      )}
    />
  );
}
