// Outbound Hooks: grouped master–detail, delivery attention, public preview and editor
// (STATUS "Hooks"; docs/demos/shared/page-hooks.js). The selected hook lives at ?h=.
// TODO(rrandiak): labels move to i18n.

import type { Hook, HookDelivery, HookIndex, HookPreview } from "@vera/contract/hooks";
import { hasPermission } from "@vera/domain/permissions";
import { Webhook } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  createHook,
  deleteHook,
  discardDelivery,
  pauseHook,
  previewHook,
  resumeHook,
  retryDelivery,
  retryHookDeliveries,
  saveHook,
  sendHookNow,
} from "@/api/hooks";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import { Field } from "@/components/classification-fields";
import { DetailCard, FactGrid, FinePrint } from "@/components/detail-card";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { FilterBar } from "@/components/filters/filter-bar";
import { MasterDetail } from "@/components/layout/master-detail";
import { PageHeader } from "@/components/layout/page-header";
import { GroupHeader } from "@/components/lists/group-header";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { RecordList } from "@/components/lists/record-list";
import { NoticeLine } from "@/components/notice-line";
import { Pane, paneStateOf } from "@/components/pane-state";
import { failureOf } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HookEditor } from "@/features/hooks/hook-editor";
import {
  activityOf,
  hookFacetsOf,
  hookGroupOf,
  hooksView,
  shownHooksOf,
} from "@/features/hooks/hooks-view";
import { hookInvalidations, useHooksQuery } from "@/features/hooks/use-hooks-query";
import type { Refusal } from "@/hooks/use-action-mutation";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useViewUrlState } from "@/hooks/use-view-url-state";
import { agoText, aheadText } from "@/lib/format-moment";

interface HookGroup {
  key: string;
  rowCount: number;
}
type Confirmation = { kind: "discard"; delivery: HookDelivery } | { kind: "delete"; hook: Hook };
type Notice = { title: string; detail: string; tone: "green" | "red" };

const localPaging = { hasMore: false, isLoadingMore: false, onLoadMore: () => {} };

// Each hook: where it sends and to whom, what it fires on, its last seven days and its state.
export function hookColumns(index: HookIndex | undefined): ColumnDefinition<Hook>[] {
  return [
    {
      key: "hook",
      header: "Hook",
      track: "minmax(11rem,1.5fr)",
      cell: (hook) => (
        <>
          <strong className="block font-medium">{hook.name}</strong>
          <span className="text-xs text-muted-foreground">
            {index?.channels.find((channel) => channel.id === hook.channelId)?.name ??
              "Channel unavailable"}{" "}
            · {hook.recipient}
          </span>
        </>
      ),
    },
    {
      key: "event",
      header: "Fires on",
      track: "minmax(8rem,1fr)",
      cell: (hook) => (
        <>
          <span className="font-mono text-xs">{hook.events.join(" · ")}</span>
          {hook.filter && (
            <span className="block text-xs text-muted-foreground">{hook.filter}</span>
          )}
        </>
      ),
    },
    {
      key: "week",
      header: "7 days",
      track: "max-content",
      cell: (hook) => <ActivityBars values={index ? activityOf(index, hook.id) : []} />,
    },
    {
      key: "state",
      header: "State",
      track: "max-content",
      cell: (hook) => (
        <span
          className={
            hook.state === "active" ? "text-tone-green-foreground" : "text-muted-foreground"
          }
        >
          {hook.state === "active" ? "Active" : "Paused"}
        </span>
      ),
    },
  ];
}

export function HooksPage() {
  const view = useViewUrlState(hooksView, "h");
  const { data: session } = useSessionQuery();
  const { data: index, isLoading, isError, refetch } = useHooksQuery();
  const [editor, setEditor] = useState<{ hook: Hook | null; startWithTest: boolean } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [pauseTarget, setPauseTarget] = useState<Hook | null>(null);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseRefusal, setPauseRefusal] = useState<Refusal | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const create = useActionMutation({ call: createHook, invalidates: hookInvalidations });
  const save = useActionMutation({
    call: ({ id, draft }: { id: string; draft: Parameters<typeof saveHook>[1] }) =>
      saveHook(id, draft),
    invalidates: hookInvalidations,
  });
  const remove = useActionMutation({ call: deleteHook, invalidates: hookInvalidations });
  const pause = useActionMutation({
    call: ({ id, reason }: { id: string; reason: string }) => pauseHook(id, reason),
    invalidates: hookInvalidations,
  });
  const resume = useActionMutation({ call: resumeHook, invalidates: hookInvalidations });
  const retry = useActionMutation({ call: retryDelivery, invalidates: hookInvalidations });
  const retryAll = useActionMutation({ call: retryHookDeliveries, invalidates: hookInvalidations });
  const discard = useActionMutation({ call: discardDelivery, invalidates: hookInvalidations });
  const sendNow = useActionMutation({ call: sendHookNow, invalidates: hookInvalidations });

  if (session === undefined) return null;
  const canConfigure = hasPermission(session, "hook.configure");
  const selected = index?.hooks.find((hook) => hook.id === view.selectedId) ?? null;
  const shown = index === undefined ? [] : shownHooksOf(index, view.query);
  const groups: HookGroup[] = [];
  for (const hook of shown) {
    const key = hookGroupOf(hook);
    const last = groups.at(-1);
    if (last?.key === key) last.rowCount += 1;
    else groups.push({ key, rowCount: 1 });
  }

  const announce = (title: string, detail: string, tone: Notice["tone"] = "green") =>
    setNotice({ title, detail, tone });
  const run = async <T,>(
    action: Promise<{ isDone: true; value: T } | { isDone: false; refusal: { message: string } }>,
    success: string,
  ) => {
    const result = await action;
    if (result.isDone)
      announce(success, "The Hooks list and delivery history are being refreshed.");
    else announce("Could not complete the action", result.refusal.message, "red");
    return result;
  };

  const headerActions: ViewAction[] = canConfigure
    ? [
        {
          id: "new",
          label: "New hook…",
          isPrimary: true,
          onSelect: () => setEditor({ hook: null, startWithTest: false }),
        },
      ]
    : [];
  return (
    <>
      <PageHeader title="Hooks" actions={headerActions} />
      {notice !== null && (
        <NoticeLine
          tone={notice.tone}
          title={notice.title}
          onDismiss={() => setNotice(null)}
          className="mx-4 mt-3"
        >
          {notice.detail}
        </NoticeLine>
      )}
      <FilterBar
        fields={hooksView.fields}
        query={view.query}
        facets={index && hookFacetsOf(index, view.query)}
        onQueryChange={view.setQuery}
        searchLabel="Search hooks"
        searchPlaceholder="Search hooks, events and recipients…"
      />
      <MasterDetail
        master={
          <RecordList
            rows={shown}
            rowId={(hook) => hook.id}
            total={index === undefined ? undefined : shown.length}
            toolbar={{ count: `${shown.length} ${shown.length === 1 ? "hook" : "hooks"}` }}
            groups={{
              items: groups,
              keyOf: (group) => group.key,
              header: (group) => (
                <GroupHeader
                  title={group.key}
                  meta={`${group.rowCount} ${group.rowCount === 1 ? "hook" : "hooks"}`}
                />
              ),
            }}
            columns={hookColumns(index)}
            card={{
              eyebrow: (hook) =>
                hook.events.length > 1
                  ? `${hook.events[0]} +${hook.events.length - 1}`
                  : hook.events[0],
              title: (hook) => hook.name,
              meta: (hook) => (
                <>
                  {index?.channels.find((channel) => channel.id === hook.channelId)?.name} ·{" "}
                  {hook.recipient} · {hook.state}
                </>
              ),
            }}
            whyOf={(hook) => {
              const count =
                index?.deliveries.filter(
                  (delivery) => delivery.hookId === hook.id && delivery.state === "gave_up",
                ).length ?? 0;
              return count > 0 ? (
                <span className="font-medium text-destructive">
                  {count} {count === 1 ? "delivery" : "deliveries"} gave up
                </span>
              ) : (
                (hook.pause?.reason ?? null)
              );
            }}
            paging={localPaging}
            isLoading={isLoading}
            selectedId={view.selectedId}
            onSelect={view.select}
            loadingText="Loading hooks…"
            emptyText="No hooks match these filters."
            failure={failureOf({ isError, refetch }, "Could not load hooks.")}
            loadingMoreText="Loading more hooks…"
          />
        }
        detail={
          <Pane
            state={paneStateOf(
              view.selectedId,
              index === undefined ? undefined : selected,
              "This hook no longer exists",
            )}
            emptyIcon={Webhook}
            emptyText="Select a hook"
            render={(hook) => (
              <HookDetail
                key={hook.id}
                hook={hook}
                index={index as HookIndex}
                canConfigure={canConfigure}
                canReadPlugins={hasPermission(session, "plugin.read")}
                onEdit={() => setEditor({ hook, startWithTest: false })}
                onTest={() => setEditor({ hook, startWithTest: true })}
                onPause={() => {
                  setPauseReason("");
                  setPauseRefusal(null);
                  setPauseTarget(hook);
                }}
                onResume={() => void run(resume.run(hook.id), "Hook resumed")}
                onDelete={() => setConfirmation({ kind: "delete", hook })}
                onRetry={(id) => void run(retry.run(id), "Delivery retried")}
                onRetryAll={() => void run(retryAll.run(hook.id), "Deliveries retried")}
                onDiscard={(delivery) => setConfirmation({ kind: "discard", delivery })}
                onSendNow={() => void run(sendNow.run(hook.id), "Waiting deliveries sent")}
              />
            )}
          />
        }
        detailTitle={selected?.name ?? "Hook"}
        detailOpen={view.selectedId !== null}
        onDetailOpenChange={(open) => {
          if (!open) view.select(null);
        }}
        swipe={{
          items: shown,
          idOf: (hook) => hook.id,
          labelOf: (hook) => hook.name,
          currentId: view.selectedId,
          onSelect: view.select,
        }}
      />
      {editor !== null && index !== undefined && (
        <HookEditor
          key={editor.hook === null ? "new" : `${editor.hook.id}-${editor.startWithTest}`}
          hook={editor.hook}
          startWithTest={editor.startWithTest}
          channels={index.channels}
          onClose={() => setEditor(null)}
          onSave={(draft) =>
            editor.hook === null ? create.run(draft) : save.run({ id: editor.hook.id, draft })
          }
          onSaved={(hook) => {
            setEditor(null);
            view.select(hook.id);
            announce(editor.hook === null ? "Hook created" : "Hook saved", hook.name);
          }}
        />
      )}
      {confirmation !== null && (
        <ConsequenceDialog
          isOpen
          onClose={() => setConfirmation(null)}
          title={
            confirmation.kind === "delete"
              ? `Delete ${confirmation.hook.name}?`
              : "Discard this delivery?"
          }
          description="Confirm the delivery consequence."
          consequences={
            confirmation.kind === "delete"
              ? [
                  { text: "This hook will stop sending permanently.", tone: "red" },
                  { text: "Its delivery history remains for the retention period." },
                ]
              : [
                  {
                    text: `${confirmation.delivery.subjects.join(", ")} will not be sent to ${confirmation.delivery.recipient}.`,
                    tone: "red",
                  },
                  { text: "The source event stays in its record history." },
                ]
          }
          confirmLabel={confirmation.kind === "delete" ? "Delete hook" : "Discard delivery"}
          isDestructive
          onConfirm={async () => {
            const target = confirmation;
            const result =
              target.kind === "delete"
                ? await remove.run(target.hook.id)
                : await discard.run(target.delivery.id);
            if (result.isDone) {
              if (target.kind === "delete") view.select(null);
              announce(
                target.kind === "delete" ? "Hook deleted" : "Delivery discarded",
                target.kind === "delete" ? target.hook.name : target.delivery.subjects.join(", "),
              );
            }
            return result;
          }}
        />
      )}
      {pauseTarget !== null && (
        <DialogShell
          isOpen
          onClose={() => setPauseTarget(null)}
          title={`Pause ${pauseTarget.name}?`}
          description="Pause this hook"
          isDirty={pauseReason.trim() !== ""}
          refusal={pauseRefusal}
          primary={{
            label: "Pause hook",
            isDisabled: pauseReason.trim() === "",
            onSelect: () =>
              void (async () => {
                const result = await pause.run({ id: pauseTarget.id, reason: pauseReason.trim() });
                if (result.isDone) {
                  setPauseTarget(null);
                  announce("Hook paused", "Events while paused will not be sent later.");
                } else setPauseRefusal(result.refusal);
              })(),
          }}
        >
          <div className="grid gap-4">
            <p>
              Events that happen while this hook is paused are not sent later. Resuming starts with
              the next event.
            </p>
            <Field id="hook-pause-reason" label="Why">
              <Input
                id="hook-pause-reason"
                value={pauseReason}
                onChange={(event) => setPauseReason(event.target.value)}
              />
            </Field>
          </div>
        </DialogShell>
      )}
    </>
  );
}

function ActivityBars({ values }: { values: readonly number[] }) {
  const max = Math.max(1, ...values);
  const days = [
    "six days ago",
    "five days ago",
    "four days ago",
    "three days ago",
    "two days ago",
    "yesterday",
    "today",
  ] as const;
  return (
    <span
      role="img"
      aria-label={`${values.reduce((sum, value) => sum + value, 0)} attempts in the last 7 days`}
      className="inline-flex h-6 items-end gap-0.5 align-middle"
    >
      {values.map((value, index) => (
        <span
          key={days[index]}
          className="w-1.5 rounded-sm bg-primary/65"
          style={{ height: `${value === 0 ? 12 : 25 + (value / max) * 75}%` }}
        />
      ))}
    </span>
  );
}

interface HookDetailProps {
  hook: Hook;
  index: HookIndex;
  canConfigure: boolean;
  canReadPlugins: boolean;
  onEdit: () => void;
  onTest: () => void;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  onRetry: (id: string) => void;
  onRetryAll: () => void;
  onDiscard: (delivery: HookDelivery) => void;
  onSendNow: () => void;
}

function HookDetail({
  hook,
  index,
  canConfigure,
  canReadPlugins,
  onEdit,
  onTest,
  onPause,
  onResume,
  onDelete,
  onRetry,
  onRetryAll,
  onDiscard,
  onSendNow,
}: HookDetailProps) {
  const exhausted = index.deliveries.filter(
    (delivery) => delivery.hookId === hook.id && delivery.state === "gave_up",
  );
  const waiting = index.deliveries.filter(
    (delivery) => delivery.hookId === hook.id && delivery.state === "waiting",
  );
  const history = index.attempts
    .filter((attempt) =>
      index.deliveries.some(
        (delivery) => delivery.id === attempt.deliveryId && delivery.hookId === hook.id,
      ),
    )
    .toSorted((left, right) => right.at.localeCompare(left.at));
  const channel = index.channels.find((candidate) => candidate.id === hook.channelId);
  const [previewError, setPreviewError] = useState("");
  const [preview, setPreview] = useState<HookPreview | null>(null);
  useEffect(() => {
    let isCurrent = true;
    previewHook(hook)
      .then((result) => {
        if (isCurrent) setPreview(result);
      })
      .catch((error) => {
        if (isCurrent)
          setPreviewError(error instanceof Error ? error.message : "Preview unavailable");
      });
    return () => {
      isCurrent = false;
    };
  }, [hook]);
  const actions: ViewAction[] = canConfigure
    ? [
        { id: "test", label: "Test…", onSelect: onTest },
        { id: "edit", label: "Edit…", onSelect: onEdit },
        {
          id: "state",
          label: hook.state === "active" ? "Pause…" : "Resume",
          onSelect: hook.state === "active" ? onPause : onResume,
        },
        { id: "delete", label: "Delete…", isDestructive: true, isInMenu: true, onSelect: onDelete },
      ]
    : [];

  return (
    <article className="@container mx-auto grid max-w-5xl gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="hidden text-xl font-semibold break-words md:block">{hook.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground break-all">
            {channel?.name ?? "Channel unavailable"} · {hook.recipient}
          </p>
        </div>
        <ActionBar actions={actions} menuLabel="More" />
      </div>
      {hook.state === "paused" && (
        <div className="rounded-lg border bg-muted px-4 py-3 text-sm">
          <strong>Paused.</strong> {hook.pause?.reason} Events while paused are not sent later.
        </div>
      )}
      {exhausted.length > 0 && (
        <DetailCard
          title={`${exhausted.length} ${exhausted.length === 1 ? "delivery" : "deliveries"} gave up`}
          action={
            canConfigure && exhausted.length > 1 ? (
              <Button size="sm" variant="outline" onClick={onRetryAll}>
                Retry all
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-3">
            {exhausted.map((delivery) => (
              <div
                key={delivery.id}
                className="rounded-md border border-destructive/30 bg-destructive/5 p-3"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <strong>{delivery.subjects.join(", ")}</strong> ·{" "}
                    {agoText(delivery.lastAt, index.asOf)}
                    <p className="text-xs text-destructive">
                      {delivery.lastError ?? "Delivery failed"} · {delivery.attempts} attempts
                    </p>
                  </div>
                  {canConfigure && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => onRetry(delivery.id)}>
                        Retry
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onDiscard(delivery)}>
                        Discard…
                      </Button>
                    </div>
                  )}
                </div>
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer">What it tried to send</summary>
                  <p className="mt-2 whitespace-pre-wrap break-words">{delivery.publicText}</p>
                </details>
              </div>
            ))}
          </div>
        </DetailCard>
      )}
      {waiting.length > 0 && (
        <DetailCard
          title={`Waiting to send · ${waiting.length}`}
          action={
            canConfigure ? (
              <Button size="sm" variant="outline" onClick={onSendNow}>
                Send now
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-3">
            {waiting.map((delivery) => (
              <div key={delivery.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                <strong>{delivery.recipient}</strong> · {delivery.subjects.length} events
                <p className="text-xs text-muted-foreground">
                  {delivery.subjects.join(" · ")} · sends{" "}
                  {delivery.sendAt ? aheadText(delivery.sendAt, index.asOf) : "when due"}
                </p>
              </div>
            ))}
          </div>
        </DetailCard>
      )}
      <DetailCard title="Subscription">
        <FactGrid
          facts={[
            {
              label: "Fires on",
              value: <span className="font-mono text-xs">{hook.events.join(" · ")}</span>,
            },
            { label: "Only when", value: hook.filter || "Every event" },
            { label: "Sends to", value: hook.recipient },
            {
              label: "Through",
              value:
                canReadPlugins && channel ? (
                  <Link
                    to={`/plugins?i=${encodeURIComponent(channel.id)}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {channel.name}
                  </Link>
                ) : (
                  (channel?.name ?? "Unavailable")
                ),
            },
            {
              label: "Timing",
              value: hook.batch
                ? `Wait ${hook.batch.waitMinutes} min after the last event; at most ${hook.batch.maxMinutes} min. Combine by ${hook.batch.by}.`
                : "Send each event at once",
            },
            {
              label: "If it fails",
              value: `${hook.retry.attempts} attempts · ${hook.retry.backoff === "fixed" ? "5 min apart" : "growing wait: 1, 2, 4… min"}`,
            },
          ]}
        />
      </DetailCard>
      <DetailCard title="What it sends">
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="mb-2 text-xs text-muted-foreground">
            {channel?.interface ?? "Channel"} · {hook.recipient}
          </p>
          <p className="whitespace-pre-wrap break-words">
            {preview?.publicText ??
              (previewError ? "Preview unavailable." : "Loading public preview…")}
          </p>
        </div>
        <FinePrint>
          Public wording only. Internal reasons and channel secrets are not included.
        </FinePrint>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() =>
            void previewHook(hook)
              .then((result) => {
                setPreview(result);
                setPreviewError("");
              })
              .catch((error) =>
                setPreviewError(error instanceof Error ? error.message : "Preview unavailable"),
              )
          }
        >
          Refresh preview
        </Button>
        {previewError && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {previewError}
          </p>
        )}
      </DetailCard>
      <DetailCard title={`Deliveries · ${history.length} attempts`}>
        {history.length === 0 ? (
          <p className="text-muted-foreground">Nothing sent yet.</p>
        ) : (
          <div className="divide-y">
            {history.slice(0, 20).map((attempt) => {
              const delivery = index.deliveries.find((item) => item.id === attempt.deliveryId);
              return (
                <div
                  key={attempt.id}
                  className="grid gap-1 py-2 text-xs sm:grid-cols-[7rem_minmax(0,1fr)_auto]"
                >
                  <span>{agoText(attempt.at, index.asOf)}</span>
                  <span className="break-words">
                    {delivery?.subjects.join(", ")} · {attempt.detail}
                  </span>
                  <span
                    className={
                      attempt.result === "sent" ? "text-tone-green-foreground" : "text-destructive"
                    }
                  >
                    {attempt.result} · {attempt.durationMs} ms
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <FinePrint>
          Delivery history is kept for {index.retentionDays} days. A delivery that gave up stays
          until retried or discarded.
        </FinePrint>
      </DetailCard>
    </article>
  );
}
