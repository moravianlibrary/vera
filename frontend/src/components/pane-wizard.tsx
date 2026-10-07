// A wizard drawn in the pane rather than a dialog (component-interfaces.md §1.9), for a change that
// moves data and deserves its room: the same step frame as SteppedDialog (§6.7), a Cancel that
// goes back to the record, Back from the second step on, and the server's refusal said inline
// above the primary. The page routes it (Categories: `?refine=1`), so a phone gets it in its
// full-screen pane sheet. Refine on Categories is the first.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import { StepIndicator } from "@/components/dialogs/step-indicator";
import { Button } from "@/components/ui/button";
import type { Refusal } from "@/hooks/use-action-mutation";

interface PaneWizardProps {
  title: string;
  // What the wizard does, under the title.
  description: string;
  steps: readonly string[];
  currentIndex: number;
  onCancel: () => void;
  // From the second step on.
  onBack?: () => void;
  primary: { label: string; isPending?: boolean; isDisabled?: boolean; onSelect: () => void };
  refusal?: Refusal | null;
  // Above the title: where the record sits.
  breadcrumb?: ReactNode;
  children: ReactNode;
}

export function PaneWizard({
  title,
  description,
  steps,
  currentIndex,
  onCancel,
  onBack,
  primary,
  refusal = null,
  breadcrumb,
  children,
}: PaneWizardProps) {
  return (
    <article className="@container max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-x-4">
        <header className="mb-3 min-w-0">
          {breadcrumb}
          <h2 className="text-xl leading-7 font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Step {currentIndex + 1} of {steps.length} · {description}
          </p>
        </header>
        <Button size="sm" variant="outline" className="mb-3" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <div className="mb-4">
        <StepIndicator steps={steps} currentIndex={currentIndex} />
      </div>
      <div className="grid gap-4">
        {children}
        {refusal !== null && (
          <p role="alert" className="text-xs text-destructive">
            {refusal.message}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {onBack !== undefined && (
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          <Button
            disabled={primary.isPending === true || primary.isDisabled === true}
            onClick={primary.onSelect}
          >
            {primary.label}
          </Button>
        </div>
      </div>
    </article>
  );
}
