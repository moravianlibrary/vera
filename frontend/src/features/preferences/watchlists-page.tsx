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
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { listWatchlists } from "@/api/watchlists";
import { ShareWatchlistDialog } from "@/components/filters/share-watchlist-dialog";
import { navigationEntries } from "@/components/layout/navigation";
import { PageContent, PageHeader } from "@/components/layout/page-header";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  isOffForAll,
  isPushOffForAll,
  pushChannelName,
  unreachableTextOf,
  useWatchlistChannelsQuery,
} from "@/features/preferences/watchlist-channels";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useUsersQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useUserSettingsQuery } from "@/hooks/use-user-settings-query";
import { useWatchlistMutations, watchlistsQueryKey } from "@/hooks/use-watchlists-query";
import type { PushPermission } from "@/lib/push";
import { allowPush, pushPermission, registerThisBrowser } from "@/lib/push";

function viewLabel(view: WatchlistView): string {
  if (view === "my-documents") return "My Documents";
  return navigationEntries.find((entry) => entry.id === view)?.label ?? view;
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
  const [params] = useSearchParams();

  return (
    <>
      <PageHeader title="Watchlists" />
      <PageContent className="bg-muted/20">
        <div className="mx-auto max-w-6xl">
          <WatchlistDirectory selectedId={params.get("watchlist")} />
        </div>
      </PageContent>
    </>
  );
}

function WatchlistDirectory({ selectedId }: { selectedId: string | null }) {
  const { data: session } = useSessionQuery();
  const { data: userSettings } = useUserSettingsQuery();
  const { data: channels = [] } = useWatchlistChannelsQuery();
  const canShare = session !== undefined && hasPermission(session, "watchlist.manage_system");
  const { data: users = [] } = useUsersQuery({ isEnabled: canShare });
  const queryClient = useQueryClient();
  const {
    data: visibleWatchlists = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: [...watchlistsQueryKey, "visible"],
    queryFn: () => listWatchlists(),
  });
  const { data: managedSystem = [] } = useQuery({
    queryKey: [...watchlistsQueryKey, "manage-system"],
    queryFn: () => listWatchlists(undefined, "manage-system"),
    enabled: canShare,
  });
  const watchlists = [
    ...visibleWatchlists,
    ...managedSystem.filter((item) => !visibleWatchlists.some((visible) => visible.id === item.id)),
  ];
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
      setError("Could not save the watchlist preference.");
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
      setError("Could not reorder watchlists.");
    }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold">Watchlists</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Personal and system saved searches, grouped by the view they open. Open one to change its
        filter.
      </p>
      {userSettings?.notifications?.doNotSend && (
        <p className="mt-3 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
          External notifications are paused by your{" "}
          <Link to="/preferences/notifications" className="underline">
            Do not send notifications
          </Link>{" "}
          preference. Watchlist badges still update.
        </p>
      )}
      <PushPermissionLine />
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {isPending && <p className="mt-5 text-sm text-muted-foreground">Loading watchlists…</p>}
      {isError && (
        <p role="alert" className="mt-5 text-sm text-destructive">
          Could not load watchlists.
        </p>
      )}
      {!isPending && !isError && groups.length === 0 && (
        <p className="mt-5 text-sm text-muted-foreground">
          No watchlists yet. Save one from a view’s filter bar.
        </p>
      )}
      <div className="mt-5 space-y-6">
        {groups.map(({ view, entries }) => (
          <div key={view} className="overflow-hidden rounded-lg border bg-background">
            <h3 className="border-b bg-muted px-4 py-2 text-sm font-semibold">{viewLabel(view)}</h3>
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[44%] pl-4">Watchlist</TableHead>
                  <TableHead className="w-[25%]">Delivery</TableHead>
                  <TableHead className="w-[31%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((watchlist, index) => (
                  <TableRow
                    key={watchlist.id}
                    id={`watchlist-${watchlist.id}`}
                    className={selectedId === watchlist.id ? "bg-accent/40" : ""}
                  >
                    <TableCell className="min-w-0 break-words py-3 pl-4 align-top whitespace-normal">
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
                              setError("Could not rename watchlist.");
                            }
                          }}
                          className="flex flex-wrap gap-2"
                        >
                          <Input
                            aria-label="Watchlist name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            maxLength={100}
                            required
                          />
                          <Button type="submit" size="sm" disabled={busy || !name.trim()}>
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </Button>
                        </form>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            {visibleIds.has(watchlist.id) ? (
                              <Link
                                to={watchlistHref(watchlist)}
                                className="font-medium hover:underline"
                              >
                                {watchlist.name}
                              </Link>
                            ) : (
                              <strong className="font-medium">{watchlist.name}</strong>
                            )}
                            {isShared(watchlist) && <Badge variant="outline">System</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {Object.entries(watchlist.filter)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(" · ") || "No filter"}
                            {" · "}
                            {watchlist.itemCount} items
                            {watchlist.newCount > 0 ? ` · ${watchlist.newCount} new` : ""}
                            {isShared(watchlist) && canShare
                              ? ` · Created by ${users.find((user) => user.id === watchlist.createdBy)?.name ?? watchlist.createdBy} · ${watchlist.subscriberCount} subscribers`
                              : ""}
                          </p>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="align-top whitespace-normal">
                      {visibleIds.has(watchlist.id) && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                          {channels.map((channel) => {
                            const isOn = isChannelOn(watchlist.viewer, channel.id);
                            const why = unreachableTextOf(channel);
                            return (
                              <span key={channel.id} className="flex items-center gap-2">
                                <Switch
                                  aria-label={`${watchlist.name} ${channel.name} notifications`}
                                  checked={isOn}
                                  disabled={busy || (why !== null && !isOn)}
                                  onCheckedChange={(isChecked) =>
                                    changeViewer(watchlist, {
                                      channels: { [channel.id]: isChecked },
                                      ...(isChecked
                                        ? { confirmedFilter: String(watchlist.filterVersion) }
                                        : {}),
                                    })
                                  }
                                />
                                {channel.name}
                                {why !== null && (
                                  <span className="text-muted-foreground">{why}</span>
                                )}
                                {why === null && isOn && isOffForAll(userSettings, channel.id) && (
                                  <span className="text-tone-amber-foreground">
                                    Off for all watchlists
                                  </span>
                                )}
                              </span>
                            );
                          })}
                          <span className="flex items-center gap-2">
                            <Switch
                              aria-label={`${watchlist.name} browser notifications`}
                              checked={watchlist.viewer.push}
                              disabled={busy}
                              onCheckedChange={(push) => changeViewer(watchlist, { push })}
                            />
                            {pushChannelName}
                            {watchlist.viewer.push && isPushOffForAll(userSettings) && (
                              <span className="text-tone-amber-foreground">
                                Off for all watchlists
                              </span>
                            )}
                          </span>
                          {(Object.values(watchlist.viewer.channels).some(
                            (channel) => channel.isOn,
                          ) ||
                            watchlist.viewer.push) &&
                            watchlist.viewer.confirmedFilter !==
                              String(watchlist.filterVersion) && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  changeViewer(watchlist, {
                                    confirmedFilter: String(watchlist.filterVersion),
                                  })
                                }
                              >
                                Review changed filter and resume
                              </Button>
                            )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="align-top whitespace-normal text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Move ${watchlist.name} up`}
                          title="Move up"
                          disabled={busy || index === 0 || !visibleIds.has(watchlist.id)}
                          onClick={() => move(entries, index, -1)}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Move ${watchlist.name} down`}
                          title="Move down"
                          disabled={
                            busy || index === entries.length - 1 || !visibleIds.has(watchlist.id)
                          }
                          onClick={() => move(entries, index, 1)}
                        >
                          <ArrowDown />
                        </Button>
                        {watchlist.isEditable && canShare && (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`${isShared(watchlist) ? "Audience for" : "Create system copy of"} ${watchlist.name}`}
                            title={isShared(watchlist) ? "Change audience" : "Create system copy"}
                            disabled={busy}
                            onClick={() => setSharing(watchlist)}
                          >
                            <Share2 />
                          </Button>
                        )}
                        {watchlist.isEditable && (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Rename ${watchlist.name}`}
                            title="Rename"
                            disabled={busy}
                            onClick={() => {
                              setEditing(watchlist.id);
                              setName(watchlist.name);
                            }}
                          >
                            <Pencil />
                          </Button>
                        )}
                        {watchlist.isEditable && (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Delete ${watchlist.name}`}
                            title="Delete"
                            disabled={busy}
                            onClick={() => setDeleting(watchlist)}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The saved filter will be removed
              {deleting && isShared(deleting) ? " for everyone who sees it" : ""}. The records it
              matched stay in place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={async (event) => {
                event.preventDefault();
                if (!deleting) return;
                setError("");
                try {
                  await remove.mutateAsync(deleting.id);
                  setDeleting(null);
                } catch {
                  setError("Could not delete watchlist.");
                }
              }}
            >
              Delete watchlist
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

// WATCH-delivery: nothing is pushed before the person allows the site's notifications in a
// browser. Once allowed, this browser is registered again on every visit, so a subscription the
// server lost is made again.
function PushPermissionLine() {
  const [permission, setPermission] = useState<PushPermission>(pushPermission);
  const [isAsking, setIsAsking] = useState(false);
  useEffect(() => {
    if (permission === "granted") {
      void registerThisBrowser().catch(() => false);
    }
  }, [permission]);

  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      {permission === "granted" && "Browser notifications reach this browser."}
      {permission === "denied" &&
        "This browser blocks VERA's notifications; allow them in its site settings to be notified here."}
      {permission === "unsupported" && "This browser cannot show notifications."}
      {permission === "default" && (
        <>
          Browser notifications start once you allow them here.
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
            Allow notifications in this browser
          </Button>
        </>
      )}
    </p>
  );
}
