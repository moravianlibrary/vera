// UI-running: a run opened from another page uses the same drawer and acts while keeping that page
// behind it. `?run=` names the run on the current URL; Tasks keeps its own in-page drawer.

import { hasAnyPermission, hasPermission } from "@vera/domain/permissions";
import { canCancelRun, canRunAgain, isOwnRun } from "@vera/domain/tasks";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useSearchParams } from "react-router";
import { runAgain } from "@/api/tasks";
import { DetailDrawer } from "@/components/detail-drawer";
import { CancelRunDialog } from "@/features/tasks/run-dialogs";
import { RunDrawer } from "@/features/tasks/run-drawer";
import { runOverlayParam, useOpenRunOverlay } from "@/features/tasks/run-overlay-link";
import { sourceOf, starterOf } from "@/features/tasks/run-parts";
import { taskInvalidations, useRunQuery } from "@/features/tasks/use-tasks-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useReferenceLabels } from "@/hooks/use-reference-labels";
import { useSessionQuery } from "@/hooks/use-session-query";

export function GlobalRunDrawer() {
  const { t } = useTranslation("tasks");
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { data: session } = useSessionQuery();
  const canRead =
    session !== undefined && hasAnyPermission(session, ["task.read", "task.read_own"]);
  const runId = location.pathname === "/tasks" || !canRead ? null : params.get(runOverlayParam);
  const { data: detail, isError } = useRunQuery(runId);
  const { users: nameOf } = useReferenceLabels(runId === null ? [] : ["users"]);
  const openRun = useOpenRunOverlay();
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState("");
  const rerun = useActionMutation({
    call: runAgain,
    invalidates: taskInvalidations,
    refusalTexts: {
      "task.not_rerunnable": t("globalRun.notRerunnable"),
      403: t("globalRun.forbidden"),
    },
  });
  const run = detail?.run;
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete(runOverlayParam);
    setParams(next, { replace: true });
    setCancelling(false);
    setNotice("");
  };

  return (
    <>
      <DetailDrawer
        open={runId !== null}
        onClose={close}
        title={run?.what ?? t("runDrawer.run")}
        subtitle={
          run ? (
            <>
              <span className="font-mono">{run.id}</span> · {sourceOf(run)}
            </>
          ) : undefined
        }
      >
        {notice && (
          <p role="status" className="mb-4 text-sm text-muted-foreground">
            {notice}
          </p>
        )}
        {run && session ? (
          <RunDrawer
            detail={detail}
            nameOf={nameOf}
            canSeeSchedules={hasPermission(session, "task.read")}
            canSeePlugins={hasPermission(session, "plugin.read")}
            onCancel={canCancelRun(session, run) ? () => setCancelling(true) : undefined}
            onRunAgain={
              canRunAgain(session, run)
                ? () => {
                    void rerun.run(run.id).then((result) => {
                      if (result.isDone) {
                        setNotice(t("globalRun.started", { id: result.value.id }));
                        openRun(result.value.id);
                      } else {
                        setNotice(result.refusal.message);
                      }
                    });
                  }
                : undefined
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {isError ? t("globalRun.unavailable") : t("globalRun.loading")}
          </p>
        )}
      </DetailDrawer>
      {cancelling && run && session && (
        <CancelRunDialog
          isOpen
          onClose={() => setCancelling(false)}
          run={run}
          otherStarter={
            run.startedBy === null || isOwnRun(session, run) ? null : starterOf(run, nameOf)
          }
          onCancelled={(next) => setNotice(`${next.title}. ${next.text}`)}
        />
      )}
    </>
  );
}
