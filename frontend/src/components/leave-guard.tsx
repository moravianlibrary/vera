// Asks "Discard changes?" before leaving a page that holds a draft (component-interfaces.md §9.5,
// page-composition.md §1): a route change waits for the answer, and the browser asks on its own
// before a reload or a closed tab.

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useBlocker } from "react-router";
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

export function LeaveGuard({ isDirty }: { isDirty: boolean }) {
  const { t } = useTranslation("common");
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  return (
    <AlertDialog
      open={blocker.state === "blocked"}
      onOpenChange={(isOpen) => {
        if (!isOpen && blocker.state === "blocked") {
          blocker.reset();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("dialog.discardTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("dialog.discardDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("dialog.keepEditing")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => blocker.proceed?.()}>
            {t("dialog.discard")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
