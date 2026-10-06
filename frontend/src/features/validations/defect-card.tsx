// One defect in the Validations pane (component-interfaces.md §4.5, page-validation.js
// defectHTML): what the plugin found, in its internal words and in what askers read, and its fix
// in place, the staff edit that makes it go away rather than a verdict that it may stay: count
// the pages or correct the field in VERA. A fix runs the checks again; a
// defect they no longer find needs no verdict.
// TODO(rrandiak): labels move to i18n.

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { RecheckResult } from "@/api/iterations";
import { correctField, enterPageCount } from "@/api/iterations";
import { FieldError } from "@/components/iteration-dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Defect, Iteration } from "@/domain/entities";
import type { DefectFix } from "@/domain/validations";
import { defectNameOf } from "@/domain/validations";
import { validationInvalidations } from "@/features/validations/use-validations-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { formatDay } from "@/lib/format-date";

interface DefectCardProps {
  defect: Defect;
  iteration: Iteration;
  // The fix the caller may make here; null where they may not, or once scanned.
  fix: DefectFix | null;
  onFixed: (defect: Defect, result: RecheckResult) => void;
}

export function DefectCard({ defect, iteration, fix, onFixed }: DefectCardProps) {
  const [isFixing, setIsFixing] = useState(false);

  return (
    <div className="border-b py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <b className="font-semibold">{defectNameOf(defect)}</b>
        <span className="font-mono text-xs text-muted-foreground">{defect.subject}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          found {formatDay(defect.firstSeenAt)}
        </span>
      </div>
      {defect.internalText !== null && <p className="mt-1">{defect.internalText}</p>}
      <p className="mt-1 text-xs text-muted-foreground">Askers read: “{defect.publicText}”</p>

      {fix !== null && !isFixing && (
        <Button size="sm" variant="outline" className="mt-2" onClick={() => setIsFixing(true)}>
          {fixLabelOf(fix)}
        </Button>
      )}

      {fix !== null && isFixing && (
        <FixForm
          fix={fix}
          iteration={iteration}
          onCancel={() => setIsFixing(false)}
          onFixed={(result) => {
            setIsFixing(false);
            onFixed(defect, result);
          }}
        />
      )}
    </div>
  );
}

function fixLabelOf(fix: DefectFix): string {
  switch (fix.kind) {
    case "pageCount":
      return "Enter page count…";
    case "field":
      return `Correct ${fix.subject}…`;
  }
}

// ---------------------------------------------------------------- the form in place

const fixFormSchema = z.object({ value: z.string().trim().min(1, "Enter a value") });
type FixForm = z.infer<typeof fixFormSchema>;

const pageCountFormSchema = fixFormSchema.refine(
  ({ value }) => Number.isInteger(pageCountOf(value)) && pageCountOf(value) > 0,
  { message: "Enter the pages counted, a whole number", path: ["value"] },
);

// "1 412" and "1412" are the same count.
function pageCountOf(value: string): number {
  return Number(value.replace(/\s/g, ""));
}

interface FixFormProps {
  fix: DefectFix;
  iteration: Iteration;
  onCancel: () => void;
  onFixed: (result: RecheckResult) => void;
}

function FixForm({ fix, iteration, onCancel, onFixed }: FixFormProps) {
  const id = useId();
  const isPageCount = fix.kind === "pageCount";
  const form = useForm<FixForm>({
    resolver: zodResolver(isPageCount ? pageCountFormSchema : fixFormSchema),
    defaultValues: { value: "" },
  });
  const save = useActionMutation({
    call: ({ value }: FixForm) =>
      fix.kind === "pageCount"
        ? enterPageCount(iteration.id, { pages: pageCountOf(value) })
        : correctField(iteration.id, { subject: fix.subject, value }),
    invalidates: validationInvalidations,
    refusalTexts: {
      409: "It has been scanned meanwhile; the fix goes to the catalog record.",
      422: "The checks no longer ask for this.",
    },
  });

  const submit = form.handleSubmit(async (values) => {
    const result = await save.run(values);
    if (result.isDone) {
      onFixed(result.value);
      return;
    }

    form.setError("value", { message: result.refusal.message });
  });

  return (
    <form className="mt-2 grid gap-2" onSubmit={submit}>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-value`}>
          {fix.kind === "pageCount" ? "Pages, counted" : `${fix.subject}, in VERA`}
        </Label>
        <Input
          id={`${id}-value`}
          autoFocus
          inputMode={isPageCount ? "numeric" : undefined}
          placeholder={isPageCount ? "e.g. 1 412" : "the corrected value"}
          {...form.register("value")}
        />
      </div>
      <FieldError message={form.formState.errors.value?.message} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={save.isPending}>
          Save and re-check
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
