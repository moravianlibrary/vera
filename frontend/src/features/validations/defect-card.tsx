// One defect in the Validations pane (component-interfaces.md §4.5, page-validation.js
// defectHTML): what the plugin found, in its internal words and in what askers read. Nothing is
// corrected here: a defect is repaired in the catalog and picked up by Recheck. The page count is
// the one exception (decided 2026-10-06): it is entered here, and entering it runs the checks
// again.
// TODO(rrandiak): labels move to i18n.

import { zodResolver } from "@hookform/resolvers/zod";
import type { RecheckResult } from "@vera/contract/iterations";
import type { Defect, Iteration } from "@vera/domain/entities";
import { defectNameOf } from "@vera/domain/validations";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { enterPageCount } from "@/api/iterations";
import { FieldError } from "@/components/iteration-dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validationInvalidations } from "@/features/validations/use-validations-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { formatDay } from "@/lib/format-date";

interface DefectRowProps {
  defect: Defect;
  // Beside the name: when it was found, or who accepted it.
  aside?: ReactNode;
  children?: ReactNode;
}

export function DefectRow({ defect, aside, children }: DefectRowProps) {
  return (
    <div className="border-b py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <b className="font-semibold">{defectNameOf(defect)}</b>
        <span className="font-mono text-xs text-muted-foreground">{defect.subject}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {aside ?? `found ${formatDay(defect.firstSeenAt)}`}
        </span>
      </div>
      {defect.internalText !== null && <p className="mt-1">{defect.internalText}</p>}
      <p className="mt-1 text-xs text-muted-foreground">Askers read: “{defect.publicText}”</p>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- the page count

const pageCountFormSchema = z.object({
  value: z
    .string()
    .trim()
    .refine((value) => Number.isInteger(pageCountOf(value)) && pageCountOf(value) > 0, {
      message: "Enter the pages counted, a whole number",
    }),
});
type PageCountForm = z.infer<typeof pageCountFormSchema>;

// "1 412" and "1412" are the same count.
function pageCountOf(value: string): number {
  return Number(value.replace(/\s/g, ""));
}

interface PageCountEntryProps {
  iteration: Iteration;
  onRechecked: (result: RecheckResult) => void;
}

export function PageCountEntry({ iteration, onRechecked }: PageCountEntryProps) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const form = useForm<PageCountForm>({
    resolver: zodResolver(pageCountFormSchema),
    defaultValues: { value: "" },
  });
  const save = useActionMutation({
    call: ({ value }: PageCountForm) => enterPageCount(iteration.id, { pages: pageCountOf(value) }),
    invalidates: validationInvalidations,
    refusalTexts: {
      "iteration.scanned": "It has been scanned meanwhile; the scan counts the pages.",
    },
  });

  if (!isOpen) {
    return (
      <Button size="sm" variant="outline" className="mt-2" onClick={() => setIsOpen(true)}>
        Enter page count…
      </Button>
    );
  }

  const submit = form.handleSubmit(async (values) => {
    const result = await save.run(values);
    if (result.isDone) {
      setIsOpen(false);
      onRechecked(result.value);
      return;
    }

    form.setError("value", { message: result.refusal.message });
  });

  return (
    <form className="mt-2 grid gap-2" onSubmit={submit}>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-value`}>Pages, counted</Label>
        <Input
          id={`${id}-value`}
          autoFocus
          inputMode="numeric"
          placeholder="e.g. 1 412"
          className="max-w-40"
          {...form.register("value")}
        />
      </div>
      <FieldError message={form.formState.errors.value?.message} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={save.isPending}>
          Save and recheck
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
