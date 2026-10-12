// One place to find personal and system saved filters, and each person's own badge and delivery choices.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { WatchlistSummary, WatchlistViewerChange } from "@/api/watchlists";
import { listWatchlists } from "@/api/watchlists";
import { ShareWatchlistDialog } from "@/components/filters/share-watchlist-dialog";
import { TabButton, TabStrip } from "@/components/filters/tab-strip";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { WatchlistAudience, WatchlistView } from "@/domain/entities";
import { isShared, watchlistViewSchema } from "@/domain/entities";
import { hasPermission } from "@/domain/permissions";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useUserSettingsQuery } from "@/hooks/use-user-settings-query";
import { useWatchlistMutations, watchlistsQueryKey } from "@/hooks/use-watchlists-query";

function viewLabel(view: WatchlistView): string {
  return navigationEntries.find((entry) => entry.id === view)?.label ?? view;
}

function watchlistHref(watchlist: WatchlistSummary): string {
  const path = navigationEntries.find((entry) => entry.id === watchlist.view)?.path ?? "/";
  const params = new URLSearchParams(watchlist.filter);
  params.set("watchlist", watchlist.id);
  return `${path}?${params}`;
}

export function WatchlistsPage() {
  const [params, setParams] = useSearchParams();
  const section = params.get("section") === "system" ? "system" : "mine";
  const changeSection = (next: "mine" | "system") => {
    setParams(next === "mine" ? {} : { section: "system" });
  };

  return (
    <>
      <PageHeader title="Watchlists" />
      <TabStrip label="Watchlist sections">
        <TabButton selected={section === "mine"} onClick={() => changeSection("mine")}>
          My watchlists
        </TabButton>
        <TabButton selected={section === "system"} onClick={() => changeSection("system")}>
          System watchlists
        </TabButton>
      </TabStrip>
      <PageContent className="bg-muted/20">
        <div className="mx-auto max-w-6xl">
          <WatchlistDirectory section={section} selectedId={params.get("watchlist")} />
        </div>
      </PageContent>
    </>
  );
}

function WatchlistDirectory({
  section,
  selectedId,
}: {
  section: "mine" | "system";
  selectedId: string | null;
}) {
  const { data: session } = useSessionQuery();
  const { data: userSettings } = useUserSettingsQuery();
  const canShare = session !== undefined && hasPermission(session, "watchlist.manage_shared");
  const queryClient = useQueryClient();
  const {
    data: watchlists = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: [...watchlistsQueryKey, section, canShare],
    queryFn: () =>
      listWatchlists(undefined, section === "system" && canShare ? "manage-system" : "visible"),
  });
  const { data: visibleWatchlists = [] } = useQuery({
    queryKey: [...watchlistsQueryKey, "visible"],
    queryFn: () => listWatchlists(),
  });
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
        .filter((item) => item.view === view && isShared(item) === (section === "system"))
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
      <h2 className="text-lg font-semibold">
        {section === "mine" ? "My watchlists" : "System watchlists"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {section === "mine"
          ? "Your saved searches. Open one in its source view to change its filter."
          : canShare
            ? "Published filters and their audiences. Your own delivery choices are separate."
            : "Saved searches published for you by your team."}
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
          {section === "mine"
            ? "No personal watchlists yet. Save one from a view’s filter bar."
            : "No system watchlists are available."}
        </p>
      )}
      <div className="mt-5 space-y-6">
        {groups.map(({ view, entries }) => (
          <div key={view} className="overflow-hidden rounded-lg border bg-background">
            <h3 className="border-b bg-muted px-4 py-2 text-sm font-semibold">{viewLabel(view)}</h3>
            <ul className="divide-y">
              {entries.map((watchlist, index) => (
                <li
                  key={watchlist.id}
                  id={`watchlist-${watchlist.id}`}
                  className={`flex flex-wrap items-center gap-3 px-4 py-3 ${selectedId === watchlist.id ? "bg-accent/40" : ""}`}
                >
                  <div className="min-w-48 flex-1">
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
                        className="flex gap-2"
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
                        <p className="text-xs text-muted-foreground">
                          {Object.entries(watchlist.filter)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(" · ") || "No filter"}
                          {" · "}
                          {watchlist.itemCount} items
                          {watchlist.newCount > 0 ? ` · ${watchlist.newCount} new` : ""}
                          {watchlist.viewer.isHidden ? " · Hidden" : ""}
                          {section === "system" && canShare
                            ? ` · Created by ${watchlist.createdBy} · ${watchlist.subscriberCount} subscribers`
                            : ""}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
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
                    {isShared(watchlist) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`${watchlist.viewer.isHidden ? "Show" : "Hide"} ${watchlist.name}`}
                        title={watchlist.viewer.isHidden ? "Show in tabs" : "Hide from tabs"}
                        disabled={busy || !visibleIds.has(watchlist.id)}
                        onClick={() =>
                          changeViewer(watchlist, { isHidden: !watchlist.viewer.isHidden })
                        }
                      >
                        {watchlist.viewer.isHidden ? <Eye /> : <EyeOff />}
                      </Button>
                    )}
                    {watchlist.isEditable && canShare && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`${section === "mine" ? "Publish" : "Audience for"} ${watchlist.name}`}
                        title={section === "mine" ? "Publish a system copy" : "Change audience"}
                        disabled={busy}
                        onClick={() => setSharing(watchlist)}
                      >
                        <Share2 />
                      </Button>
                    )}
                    {section === "system" && watchlist.isEditable && (
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
                    {section === "system" && watchlist.isEditable && (
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
                  {visibleIds.has(watchlist.id) && (
                    <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-2 text-xs">
                      <span className="flex items-center gap-2">
                        <Switch
                          aria-label={`${watchlist.name} badge`}
                          checked={watchlist.viewer.hasBadge}
                          disabled={busy}
                          onCheckedChange={(hasBadge) => changeViewer(watchlist, { hasBadge })}
                        />
                        Badge
                      </span>
                      <span className="flex items-center gap-2">
                        <Switch
                          aria-label={`${watchlist.name} email notifications`}
                          checked={watchlist.viewer.email}
                          disabled={busy}
                          onCheckedChange={(email) =>
                            changeViewer(watchlist, {
                              email,
                              ...(email
                                ? { confirmedFilter: String(watchlist.filterVersion) }
                                : {}),
                            })
                          }
                        />
                        Email
                      </span>
                      <span className="flex items-center gap-2">
                        <Switch
                          aria-label={`${watchlist.name} chat notifications`}
                          checked={watchlist.viewer.chat}
                          disabled={busy}
                          onCheckedChange={(chat) =>
                            changeViewer(watchlist, {
                              chat,
                              ...(chat ? { confirmedFilter: String(watchlist.filterVersion) } : {}),
                            })
                          }
                        />
                        Chat
                      </span>
                      {(watchlist.viewer.email || watchlist.viewer.chat) &&
                        watchlist.viewer.confirmedFilter !== String(watchlist.filterVersion) && (
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
                </li>
              ))}
            </ul>
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
