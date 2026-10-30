// One place to find personal and system saved filters, and each person's delivery choices: each
// Delivery channel instance that can reach them off until switched on, named by the instance,
// browser push on for every watchlist once this browser may notify (WATCH-delivery), whose
// permission is asked here and moves with these preferences. A switch that is on says so when
// its channel is off for every watchlist (WATCH-channel-off).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { WatchlistSummary, WatchlistViewerChange } from "@vera/contract/watchlists";
import { isChannelOn } from "@vera/contract/watchlists";
import type { WatchlistAudience, WatchlistView } from "@vera/domain/entities";
import { isShared, watchlistViewSchema } from "@vera/domain/entities";
import { hasPermission } from "@vera/domain/permissions";
import { ArrowDown, ArrowUp, Pencil, Share2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { listWatchlists } from "@/api/watchlists";
import { DataTable } from "@/components/data-table";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import { ShareWatchlistDialog } from "@/components/filters/share-watchlist-dialog";
import { navigationEntries } from "@/components/layout/navigation";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { failureOf, QueryError } from "@/components/query-state";
import { ToneBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  isOffForAll,
  isPushOffForAll,
  pushChannelName,
  unreachableTextOf,
  useWatchlistChannelsQuery,
} from "@/features/preferences/watchlist-channels";
import type { ActionResult } from "@/hooks/use-action-mutation";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useUsersQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useUserSettingsQuery } from "@/hooks/use-user-settings-query";
import { useWatchlistMutations, watchlistsQueryKey } from "@/hooks/use-watchlists-query";
import { i18n } from "@/i18n";
import type { PushPermission } from "@/lib/push";
import { allowPush, pushPermission, registerThisBrowser } from "@/lib/push";

function viewLabel(view: WatchlistView): string {
  const key = navigationEntries.find((entry) => entry.id === view)?.label;
  return key === undefined ? view : i18n.t(key);
}

function watchlistHref(watchlist: WatchlistSummary): string {
  const path =
    watchlist.view === "my-documents"
      ? "/my-documents"
      : (navigationEntries.find((entry) => entry.id === watchlist.view)?.path ?? "/");
  const params = new URLSearchParams(watchlist.filter);
  params.set("watchlist", watchlist.id);
  return `${path}?${params}`;
}

export function WatchlistsPage() {
  const { t } = useTranslation("preferences");
  const [params] = useSearchParams();

  return (
    <>
      <PageHeader title={t("watchlists.systemTitle")} />
      <PageContent className="bg-muted/20">
        <div className="mx-auto max-w-6xl">
          <WatchlistDirectory selectedId={params.get("watchlist")} mode="system" />
        </div>
      </PageContent>
    </>
  );
}

export function WatchlistPreferences() {
  const [params] = useSearchParams();
  return <WatchlistDirectory selectedId={params.get("watchlist")} mode="preferences" />;
}

function WatchlistDirectory({
  selectedId,
  mode,
}: {
  selectedId: string | null;
  mode: "system" | "preferences";
}) {
  const { t } = useTranslation("preferences");
  const isSystem = mode === "system";
  const { data: session } = useSessionQuery();
  const { data: userSettings } = useUserSettingsQuery();
  const { data: channels = [] } = useWatchlistChannelsQuery();
  const canShare = session !== undefined && hasPermission(session, "watchlist.manage_system");
  const { data: users = [] } = useUsersQuery({ isEnabled: canShare && isSystem });
  const queryClient = useQueryClient();
  const visibleQuery = useQuery({
    queryKey: [...watchlistsQueryKey, "visible"],
    queryFn: () => listWatchlists(),
  });
  const { data: visibleWatchlists = [], isPending, isError } = visibleQuery;
  const systemQuery = useQuery({
    queryKey: [...watchlistsQueryKey, "manage-system"],
    queryFn: () => listWatchlists(undefined, "manage-system"),
    enabled: canShare && isSystem,
  });
  const { data: managedSystem = [], isPending: systemPending, isError: systemError } = systemQuery;
  const watchlists = isSystem ? managedSystem : visibleWatchlists;
  const tableRef = useRef<HTMLDivElement>(null);
  const selectedWatchlist = watchlists.find((watchlist) => watchlist.id === selectedId);
  useEffect(() => {
    if (selectedWatchlist !== undefined) {
      tableRef.current?.querySelector("[data-focused]")?.scrollIntoView?.({ block: "center" });
    }
  }, [selectedWatchlist]);
  const visibleIds = new Set(visibleWatchlists.map(({ id }) => id));
  const { create, update, remove, updateViewer } = useWatchlistMutations();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sharing, setSharing] = useState<WatchlistSummary | null>(null);
  const [deleting, setDeleting] = useState<WatchlistSummary | null>(null);
  const [error, setError] = useState("");
  const share = useActionMutation({
    call: ({
      watchlist,
      audience,
    }: {
      watchlist: WatchlistSummary;
      audience: WatchlistAudience;
    }) =>
      isShared(watchlist)
        ? update.mutateAsync({ watchlistId: watchlist.id, change: { audience } })
        : create.mutateAsync({
            name: watchlist.name,
            view: watchlist.view,
            filter: watchlist.filter,
            audience,
          }),
    invalidates: [watchlistsQueryKey],
  });
  const busy = update.isPending || remove.isPending || updateViewer.isPending;
  const groups = watchlistViewSchema.options
    .map((view) => ({
      view,
      entries: watchlists
        .filter((item) => item.view === view)
        .toSorted((a, b) => a.viewer.position - b.viewer.position),
    }))
    .filter((group) => group.entries.length > 0);

  const changeViewer = async (watchlist: WatchlistSummary, change: WatchlistViewerChange) => {
    setError("");
    try {
      await updateViewer.mutateAsync({ watchlistId: watchlist.id, change });
    } catch {
      setError(t("watchlists.savePreferenceError"));
    }
  };
  const move = async (items: WatchlistSummary[], index: number, offset: number) => {
    const other = items[index + offset];
    const current = items[index];
    if (!other || !current) return;
    setError("");
    try {
      await updateViewer.mutateAsync({
        watchlistId: current.id,
        change: { position: other.viewer.position },
      });
      await updateViewer.mutateAsync({
        watchlistId: other.id,
        change: { position: current.viewer.position },
      });
      await queryClient.invalidateQueries({ queryKey: watchlistsQueryKey });
    } catch {
      setError(t("watchlists.reorderError"));
    }
  };

  const columnsOf = (entries: WatchlistSummary[]): ColumnDefinition<WatchlistSummary>[] => {
    const nameColumn: ColumnDefinition<WatchlistSummary> = {
      key: "watchlist",
      header: t("watchlists.watchlistColumn"),
      track: isSystem ? "70%" : "44%",
      cell: (watchlist) => (
        <div className="min-w-0 break-words whitespace-normal">
          {editing === watchlist.id ? (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                try {
                  await update.mutateAsync({
                    watchlistId: watchlist.id,
                    change: { name: name.trim() },
                  });
                  setEditing(null);
                } catch {
                  setError(t("watchlists.renameError"));
                }
              }}
              className="flex flex-wrap gap-2"
            >
              <Input
                aria-label={t("watchlists.nameLabel")}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                required
              />
              <Button type="submit" size="sm" disabled={busy || !name.trim()}>
                {t("watchlists.save")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                {t("watchlists.cancel")}
              </Button>
            </form>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {visibleIds.has(watchlist.id) ? (
                  <Link to={watchlistHref(watchlist)} className="font-medium hover:underline">
                    {watchlist.name}
                  </Link>
                ) : (
                  <strong className="font-medium">{watchlist.name}</strong>
                )}
                {isShared(watchlist) && (
                  <ToneBadge tone="slate">{t("watchlists.system")}</ToneBadge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {Object.entries(watchlist.filter)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(" · ") || t("watchlists.noFilter")}
                {" · "}
                {t("watchlists.items", { count: watchlist.itemCount })}
                {watchlist.newCount > 0
                  ? ` · ${t("watchlists.newItems", { count: watchlist.newCount })}`
                  : ""}
                {isSystem
                  ? ` · ${t("watchlists.createdBy", { name: users.find((user) => user.id === watchlist.createdBy)?.name ?? watchlist.createdBy })} · ${t("watchlists.subscribers", { count: watchlist.subscriberCount })}`
                  : ""}
              </p>
            </>
          )}
        </div>
      ),
    };
    const delivery: ColumnDefinition<WatchlistSummary> = {
      key: "delivery",
      header: t("watchlists.deliveryColumn"),
      track: "25%",
      cell: (watchlist) =>
        !isSystem && visibleIds.has(watchlist.id) ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            {channels.map((channel) => {
              const isOn = isChannelOn(watchlist.viewer, channel.id);
              const why = unreachableTextOf(channel);
              return (
                <span key={channel.id} className="flex items-center gap-2">
                  <Switch
                    aria-label={t("watchlists.channelNotifications", {
                      watchlist: watchlist.name,
                      channel: channel.name,
                    })}
                    checked={isOn}
                    disabled={busy || (why !== null && !isOn)}
                    onCheckedChange={(isChecked) =>
                      changeViewer(watchlist, {
                        channels: { [channel.id]: isChecked },
                        ...(isChecked ? { confirmedFilter: String(watchlist.filterVersion) } : {}),
                      })
                    }
                  />
                  {channel.name}
                  {why !== null && <span className="text-muted-foreground">{why}</span>}
                  {why === null && isOn && isOffForAll(userSettings, channel.id) && (
                    <span className="text-tone-amber-foreground">{t("watchlists.offForAll")}</span>
                  )}
                </span>
              );
            })}
            <span className="flex items-center gap-2">
              <Switch
                aria-label={t("watchlists.browserNotifications", { watchlist: watchlist.name })}
                checked={watchlist.viewer.push}
                disabled={busy}
                onCheckedChange={(push) => changeViewer(watchlist, { push })}
              />
              {i18n.t(pushChannelName)}
              {watchlist.viewer.push && isPushOffForAll(userSettings) && (
                <span className="text-tone-amber-foreground">{t("watchlists.offForAll")}</span>
              )}
            </span>
            {(Object.values(watchlist.viewer.channels).some((channel) => channel.isOn) ||
              watchlist.viewer.push) &&
              watchlist.viewer.confirmedFilter !== String(watchlist.filterVersion) && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    changeViewer(watchlist, { confirmedFilter: String(watchlist.filterVersion) })
                  }
                >
                  {t("watchlists.reviewResume")}
                </Button>
              )}
          </div>
        ) : null,
    };
    const actions: ColumnDefinition<WatchlistSummary> = {
      key: "actions",
      header: t("watchlists.actionsColumn"),
      track: isSystem ? "30%" : "31%",
      cell: (watchlist) => {
        const index = entries.indexOf(watchlist);
        return (
          <div className="flex flex-wrap justify-end gap-1">
            {!isSystem && (
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("watchlists.moveUp", { name: watchlist.name })}
                title={t("watchlists.moveUpTitle")}
                disabled={busy || index === 0 || !visibleIds.has(watchlist.id)}
                onClick={() => move(entries, index, -1)}
              >
                <ArrowUp />
              </Button>
            )}
            {!isSystem && (
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("watchlists.moveDown", { name: watchlist.name })}
                title={t("watchlists.moveDownTitle")}
                disabled={busy || index === entries.length - 1 || !visibleIds.has(watchlist.id)}
                onClick={() => move(entries, index, 1)}
              >
                <ArrowDown />
              </Button>
            )}
            {isSystem && watchlist.isEditable && canShare && (
              <Button
                size="icon"
                variant="ghost"
                aria-label={t(
                  isShared(watchlist) ? "watchlists.audienceFor" : "watchlists.createSystemCopyOf",
                  { name: watchlist.name },
                )}
                title={t(
                  isShared(watchlist) ? "watchlists.changeAudience" : "watchlists.createSystemCopy",
                )}
                disabled={busy}
                onClick={() => setSharing(watchlist)}
              >
                <Share2 />
              </Button>
            )}
            {watchlist.isEditable && (isSystem || !isShared(watchlist)) && (
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("watchlists.rename", { name: watchlist.name })}
                title={t("watchlists.renameTitle")}
                disabled={busy}
                onClick={() => {
                  setEditing(watchlist.id);
                  setName(watchlist.name);
                }}
              >
                <Pencil />
              </Button>
            )}
            {watchlist.isEditable && (isSystem || !isShared(watchlist)) && (
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("watchlists.delete", { name: watchlist.name })}
                title={t("watchlists.deleteTitle")}
                disabled={busy}
                onClick={() => setDeleting(watchlist)}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        );
      },
    };
    return isSystem ? [nameColumn, actions] : [nameColumn, delivery, actions];
  };

  return (
    <section>
      <h2 className="text-lg font-semibold">
        {isSystem ? t("watchlists.definitionsTitle") : t("watchlists.personalTitle")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {isSystem ? t("watchlists.definitionsDescription") : t("watchlists.personalDescription")}
      </p>
      {!isSystem && userSettings?.notifications?.doNotSend && (
        <p className="mt-3 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
          {t("watchlists.externalNotificationsPaused")}{" "}
          <Link to="/preferences/notifications" className="underline">
            {t("notifications.doNotSend")}
          </Link>{" "}
          {t("watchlists.badgesStillUpdate")}
        </p>
      )}
      {!isSystem && <PushPermissionLine />}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {(isSystem ? systemPending : isPending) && (
        <p className="mt-5 text-sm text-muted-foreground">{t("watchlists.loading")}</p>
      )}
      {(isSystem ? systemError : isError) && (
        <QueryError
          failure={
            failureOf(isSystem ? systemQuery : visibleQuery, t("watchlists.loadError")) ?? {
              text: t("watchlists.loadError"),
              onRetry: () => void (isSystem ? systemQuery : visibleQuery).refetch(),
            }
          }
          className="mt-5"
        />
      )}
      {!(isSystem ? systemPending || systemError : isPending || isError) && groups.length === 0 && (
        <p className="mt-5 text-sm text-muted-foreground">
          {isSystem ? t("watchlists.noDefinitions") : t("watchlists.noneYet")}
        </p>
      )}
      <div ref={tableRef} className="mt-5 space-y-6">
        {groups.map(({ view, entries }) => (
          <section
            key={view}
            id={`watchlists-${view}`}
            aria-labelledby={`watchlists-${view}-heading`}
            aria-label={isSystem ? t("watchlists.viewLabel", { view: viewLabel(view) }) : undefined}
            className="overflow-hidden rounded-lg border bg-background"
          >
            <h3
              id={`watchlists-${view}-heading`}
              className="bg-muted px-4 py-2 text-sm font-semibold"
            >
              {viewLabel(view)}
            </h3>
            {/* The section's border is the table's last line; the table's own is clipped under it. */}
            <div className="-mb-px">
              <DataTable
                rows={entries}
                rowId={(watchlist) => watchlist.id}
                columns={{ notebook: columnsOf(entries) }}
                emptyText={t("watchlists.empty")}
                focusedId={selectedId}
                isHeadless={isSystem}
                flush
              />
            </div>
          </section>
        ))}
      </div>
      {sharing && (
        <ShareWatchlistDialog
          key={sharing.id}
          isOpen
          onClose={() => setSharing(null)}
          watchlist={sharing}
          mode={isShared(sharing) ? "audience" : "publish"}
          onSave={(audience) => share.run({ watchlist: sharing, audience })}
        />
      )}
      {deleting && (
        <ConsequenceDialog
          isOpen
          onClose={() => setDeleting(null)}
          title={t("watchlists.deleteConfirmTitle", { name: deleting.name })}
          description={t("watchlists.deleteConfirmDescription", { name: deleting.name })}
          confirmLabel={t("watchlists.deleteConfirm")}
          isDestructive
          consequences={[
            {
              text: t(
                isShared(deleting) ? "watchlists.deleteFilterShared" : "watchlists.deleteFilter",
              ),
            },
            { text: t("watchlists.deleteRecordsStay") },
          ]}
          onConfirm={async (): Promise<ActionResult<undefined>> => {
            try {
              await remove.mutateAsync(deleting.id);
              return { isDone: true, value: undefined };
            } catch {
              return {
                isDone: false,
                refusal: { status: null, code: null, message: t("watchlists.deleteError") },
              };
            }
          }}
        />
      )}
    </section>
  );
}

// WATCH-delivery: nothing is pushed before the person allows the site's notifications in a
// browser. Once allowed, this browser is registered again on every visit, so a subscription the
// server lost is made again.
function PushPermissionLine() {
  const { t } = useTranslation("preferences");
  const [permission, setPermission] = useState<PushPermission>(pushPermission);
  const [isAsking, setIsAsking] = useState(false);
  useEffect(() => {
    if (permission === "granted") {
      void registerThisBrowser().catch(() => false);
    }
  }, [permission]);

  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      {permission === "granted" && t("push.granted")}
      {permission === "denied" && t("push.denied")}
      {permission === "unsupported" && t("push.unsupported")}
      {permission === "default" && (
        <>
          {t("push.default")}
          <Button
            size="sm"
            variant="outline"
            disabled={isAsking}
            onClick={async () => {
              setIsAsking(true);
              setPermission(await allowPush().catch(() => pushPermission()));
              setIsAsking(false);
            }}
          >
            {t("push.allow")}
          </Button>
        </>
      )}
    </p>
  );
}
