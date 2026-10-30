// Kind F (component-interfaces.md §6.7): one dialog walked through in steps, named in its head.
// Leaving a step may ask the server first (Generate's preview), and its refusal is said beside
// what was entered, which stays. The last step's primary submits; with a result screen it then
// shows what was done, else it closes. Anything entered makes closing ask first.

import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { StepIndicator } from "@/components/dialogs/step-indicator";
import type { ActionResult, Refusal } from "@/hooks/use-action-mutation";

export interface DialogStep<State> {
  // "Ask", "Preview".
  label: string;
  render: (state: State, setState: (next: State) => void) => ReactNode;
  canAdvance: (state: State) => boolean;
  // The primary's words on a step before the last: "Generate draft". "Continue" by default.
  advanceLabel?: string;
  // Leaving the step may call the server.
  onAdvance?: (state: State) => Promise<ActionResult<State>>;
}

interface SteppedDialogProps<State> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  width?: "regular" | "wide";
  steps: readonly DialogStep<State>[];
  initialState: State;
  isDirty: (state: State) => boolean;
  // "Put 7 on the list".
  submitLabel: (state: State) => string;
  onSubmit: (state: State) => Promise<ActionResult<State>>;
  // After submitting: what was done, closed with "Done". Without one, submitting closes.
  result?: (state: State) => ReactNode;
}

export function SteppedDialog<State>({
  isOpen,
  onClose,
  title,
  description,
  width,
  steps,
  initialState,
  isDirty,
  submitLabel,
  onSubmit,
  result,
}: SteppedDialogProps<State>) {
  const { t } = useTranslation("common");
  const [state, setState] = useState(initialState);
  const [index, setIndex] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const close = () => {
    setState(initialState);
    setIndex(0);
    setRefusal(null);
    setIsSubmitted(false);
    onClose();
  };

  const settle = (outcome: ActionResult<State>): boolean => {
    setIsPending(false);
    if (!outcome.isDone) {
      setRefusal(outcome.refusal);
      return false;
    }

    setRefusal(null);
    setState(outcome.value);
    return true;
  };

  const advance = async () => {
    if (step === undefined) {
      return;
    }

    if (isLast) {
      setIsPending(true);
      if (!settle(await onSubmit(state))) {
        return;
      }

      if (result === undefined) {
        close();
        return;
      }

      setIsSubmitted(true);
      return;
    }

    if (step.onAdvance !== undefined) {
      setIsPending(true);
      if (!settle(await step.onAdvance(state))) {
        return;
      }
    }

    setIndex(index + 1);
  };

  if (step === undefined) {
    return null;
  }

  if (isSubmitted && result !== undefined) {
    return (
      <DialogShell
        isOpen={isOpen}
        onClose={close}
        title={title}
        description={description}
        width={width}
        cancelLabel={null}
        primary={{ label: t("dialog.done"), onSelect: close }}
      >
        {result(state)}
      </DialogShell>
    );
  }

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={close}
      title={title}
      description={description}
      width={width}
      isDirty={isDirty(state)}
      head={<StepIndicator steps={steps.map(({ label }) => label)} currentIndex={index} />}
      onBack={
        index === 0
          ? undefined
          : () => {
              setRefusal(null);
              setIndex(index - 1);
            }
      }
      refusal={refusal}
      primary={{
        label: isLast ? submitLabel(state) : (step.advanceLabel ?? t("dialog.continue")),
        isPending,
        isDisabled: !step.canAdvance(state),
        onSelect: () => void advance(),
      }}
    >
      {step.render(state, setState)}
    </DialogShell>
  );
}
