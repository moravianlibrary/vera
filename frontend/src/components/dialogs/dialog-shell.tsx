// The frame every dialog shares (component-interfaces.md §6.1): the title, the body, a footer
// with Cancel and the one primary button, and a server refusal said inline above it, keeping
// what was typed. Once something is typed it closes only deliberately: Esc, the overlay, × and
// Cancel ask "Discard changes?" first (page-composition.md §1). Centred where there is room,
// a full-screen sheet on a phone (decided 2026-10-06), where × in its head is the Cancel and
// an irreversible primary is outlined rather than filled (view-rules.md §5.3).
// A stepped dialog puts its steps under the title and a Back before the primary (§6.7).
// TODO(rrandiak): Back closing it on a phone (§8.1); labels move to i18n.

import type { ReactNode } from "react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Refusal } from "@/hooks/use-action-mutation";
import { useTier } from "@/hooks/use-tier";
import { cn } from "@/lib/utils";

export interface DialogPrimaryAction {
  label: string;
  isDestructive?: boolean;
  isPending?: boolean;
  // Only while a required field is empty.
  isDisabled?: boolean;
  // A hand-off elsewhere, opened in a new tab as a link (the Message dialog), rather than a call
  // to the server; `onSelect` runs as it opens.
  href?: string;
  onSelect: () => void;
}

export interface DialogShellProps {
  isOpen: boolean;
  onClose: () => void;
  // "Delete Moravica 2026?", "Decline Národní listy".
  title: ReactNode;
  // What it acts on, for assistive technology when the body does not say it first.
  description: string;
  width?: "regular" | "wide";
  // While true, closing asks "Discard changes?" first.
  isDirty?: boolean;
  primary: DialogPrimaryAction;
  // Null on a result screen, where the primary is the only way on ("Done").
  cancelLabel?: string | null;
  // Under the title: a stepped dialog's steps.
  head?: ReactNode;
  // Back to the step before.
  onBack?: () => void;
  refusal?: Refusal | null;
  children: ReactNode;
}

const widthClasses = { regular: "sm:max-w-xl", wide: "sm:max-w-4xl" } as const;

export function DialogShell({
  isOpen,
  onClose,
  title,
  description,
  width = "regular",
  isDirty = false,
  primary,
  cancelLabel = "Cancel",
  head,
  onBack,
  refusal = null,
  children,
}: DialogShellProps) {
  const isPhone = useTier() === "phone";
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
  const isFilled = primary.isDestructive !== true || !isPhone;

  const requestClose = () => {
    if (primary.isPending) {
      return;
    }

    if (isDirty) {
      setIsConfirmingDiscard(true);
      return;
    }

    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && requestClose()}>
        <DialogContent
          className={cn(
            "grid-rows-[auto_minmax(0,1fr)_auto] gap-0 p-0",
            isPhone
              ? "top-0 left-0 h-dvh max-w-none translate-x-0 translate-y-0 rounded-none border-0"
              : cn("top-[8vh] max-h-[84vh] translate-y-0 rounded-xl", widthClasses[width]),
          )}
          showCloseButton={isPhone}
        >
          <DialogHeader className="border-b px-6 py-4 text-left">
            <DialogTitle className="pr-8 leading-snug">{title}</DialogTitle>
            <DialogDescription className="sr-only">{description}</DialogDescription>
            {head}
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-6 py-5 text-sm">{children}</div>

          <div className="border-t px-6 py-4">
            {refusal !== null && (
              <p role="alert" className="mb-3 text-xs text-destructive">
                {refusal.message}
              </p>
            )}

            <DialogFooter className={cn(isPhone && "flex-col")}>
              {!isPhone && cancelLabel !== null && (
                <Button variant="outline" onClick={requestClose} disabled={primary.isPending}>
                  {cancelLabel}
                </Button>
              )}
              {onBack !== undefined && (
                <Button variant="outline" onClick={onBack} disabled={primary.isPending}>
                  Back
                </Button>
              )}
              <PrimaryButton primary={primary} isFilled={isFilled} isPhone={isPhone} />
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmingDiscard} onOpenChange={setIsConfirmingDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>What you typed here is not kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setIsConfirmingDiscard(false);
                onClose();
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface PrimaryButtonProps {
  primary: DialogPrimaryAction;
  isFilled: boolean;
  isPhone: boolean;
}

function PrimaryButton({ primary, isFilled, isPhone }: PrimaryButtonProps) {
  const variant = isFilled ? (primary.isDestructive ? "destructive" : "default") : "outline";
  const className = cn(!isFilled && "text-destructive", isPhone && "w-full");
  const isDisabled = primary.isDisabled === true || primary.isPending === true;

  // A link cannot be disabled, so a disabled hand-off is a plain button.
  if (primary.href !== undefined && !isDisabled) {
    return (
      <Button asChild variant={variant} className={className}>
        <a href={primary.href} target="_blank" rel="noopener noreferrer" onClick={primary.onSelect}>
          {primary.label}
        </a>
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      className={className}
      disabled={isDisabled}
      onClick={primary.onSelect}
    >
      {primary.label}
    </Button>
  );
}
