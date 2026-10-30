// A view's watchlists above its filter bar: All, the shared and personal saved filters, and
// Current search when the full current filter matches none of them. Changing search or any field
// selects the matching saved tab, or Current search; that tab can save a new watchlist or replace
// an editable one's filter. A bare view reopens the last saved tab. Grouping is not saved.
// New-entry badges and per-person seen state follow watchlists-and-notifications.md.

import type { WatchlistSummary } from "@vera/contract/watchlists";
import { isSameWatchlistFilter } from "@vera/contract/watchlists";
import type { Watchlist, WatchlistAudience, WatchlistView } from "@vera/domain/entities";
import { isShared } from "@vera/domain/entities";
import { Building2, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TabButton, TabStrip } from "@/components/filters/tab-strip";
import { WatchlistEditorPopover } from "@/components/filters/watchlist-editor-popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRememberedWatchlist } from "@/hooks/use-remembered-watchlist";
import { useWatchlistMutations, useWatchlistsQuery } from "@/hooks/use-watchlists-query";

type Filter = Watchlist["filter"];
const newBadgeHoldMs = 2_500;

interface WatchlistTabsProps {
  view: WatchlistView;
  // The view's current filter, in its URL form.
  filter: Filter;
  // The watchlist the filter was opened from, if any; preferred when updating a saved filter.
  openedId: string | null;
  // Whether the caller may save shared watchlists too.
  canShare: boolean;
  // Null opens "All".
  onOpen: (watchlist: Watchlist | null) => void;
  // The open watchlist is gone; the filter stays as it is.
  onDetach: () => void;
  // The view was opened bare, naming no filter, watchlist or record: it reopens on the tab the
  // caller last left it on.
  isBare: boolean;
}

export function WatchlistTabs({
  view,
  filter,
  openedId,
  canShare,
  onOpen: openInView,
  onDetach,
  isBare,
}: WatchlistTabsProps) {
  const { t } = useTranslation("common");
  const navRef = useRef<HTMLElement>(null);
  const { data: everyWatchlist = [], isSuccess } = useWatchlistsQuery(view);
  const { create, update, markSeen } = useWatchlistMutations();
  const watchlists = everyWatchlist;
  const [heldNewCounts, setHeldNewCounts] = useState<Record<string, number>>({});
  const badgeTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const holdNewCount = useCallback((watchlistId: string, count: number) => {
    if (count === 0) return;
    setHeldNewCounts((current) => ({ ...current, [watchlistId]: count }));
    const oldTimer = badgeTimers.current.get(watchlistId);
    if (oldTimer !== undefined) clearTimeout(oldTimer);
    badgeTimers.current.set(
      watchlistId,
      setTimeout(() => {
        setHeldNewCounts((current) => {
          const next = { ...current };
          delete next[watchlistId];
          return next;
        });
        badgeTimers.current.delete(watchlistId);
      }, newBadgeHoldMs),
    );
  }, []);
  useEffect(() => {
    const timers = badgeTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);
  const { isSettled, rememberedId, remember } = useRememberedWatchlist(view);
  const onOpen = (watchlist: Watchlist | null, newCount = 0) => {
    remember(watchlist?.id ?? null);
    openInView(watchlist);
    if (watchlist !== null) {
      holdNewCount(watchlist.id, newCount);
      markSeen.mutate(watchlist.id);
    }
  };

  // Once the watchlists and the settings are known; one deleted since reopens on "All".
  const hasRestoredRef = useRef(false);
  const restore = useEffectEvent(() => {
    const remembered = watchlists.find((watchlist) => watchlist.id === rememberedId);
    if (remembered !== undefined) {
      openInView(remembered);
    }
  });
  useEffect(() => {
    if (!isSuccess || !isSettled || hasRestoredRef.current) {
      return;
    }

    hasRestoredRef.current = true;
    if (isBare) {
      restore();
    }
  }, [isSuccess, isSettled, isBare]);

  const isSameFilter = (first: Filter, second: Filter) =>
    isSameWatchlistFilter(view, first, second);
  const isFiltered = Object.keys(filter).length > 0;
  const open = isFiltered
    ? (watchlists.find(
        (watchlist) => watchlist.id === openedId && isSameFilter(watchlist.filter, filter),
      ) ?? watchlists.find((watchlist) => isSameFilter(watchlist.filter, filter)))
    : undefined;
  const editable = watchlists.filter((watchlist) => watchlist.isEditable);
  const preferredUpdateId = editable.find((watchlist) => watchlist.id === openedId)?.id ?? null;
  const activeId = open?.id ?? (isFiltered ? "current" : "all");
  const openedWatchlistId = open?.id;
  const openedNewCount = open?.newCount ?? 0;
  const markSeenMutation = markSeen.mutate;

  // A deep link or restored tab is also an opening, even though no tab was clicked.
  useEffect(() => {
    if (openedWatchlistId !== undefined && openedNewCount > 0) {
      holdNewCount(openedWatchlistId, openedNewCount);
      markSeenMutation(openedWatchlistId);
    }
  }, [openedWatchlistId, openedNewCount, holdNewCount, markSeenMutation]);

  // Keep the active tab visible when a saved filter is opened from a URL or restored.
  useEffect(() => {
    if (!isSuccess) {
      return;
    }

    const nav = navRef.current;
    const active = Array.from(
      nav?.querySelectorAll<HTMLElement>("[data-watchlist-tab]") ?? [],
    ).find((tab) => tab.dataset.watchlistTab === activeId);
    if (nav === null || active === null || active === undefined) {
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    if (activeRect.right > navRect.right) {
      nav.scrollLeft += activeRect.right - navRect.right + 8;
    } else if (activeRect.left < navRect.left) {
      nav.scrollLeft -= navRect.left - activeRect.left + 8;
    }
  }, [activeId, isSuccess]);

  const saveAsNew = async (name: string, audience: WatchlistAudience) => {
    const created = await create.mutateAsync({ name, view, audience, filter });
    onOpen(created);
  };

  const updateExisting = async (
    watchlist: WatchlistSummary,
    name: string,
    audience: WatchlistAudience,
  ) => {
    const saved =
      watchlist.audience.kind === "personal" && audience.kind !== "personal"
        ? await create.mutateAsync({ name, view, audience, filter })
        : await update.mutateAsync({
            watchlistId: watchlist.id,
            change: { name, audience, filter },
          });
    onOpen(saved);
  };

  return (
    <TabStrip label={t("watchlist.tabsLabel")} navRef={navRef}>
      <Tab id="all" isOpen={open === undefined && !isFiltered} onClick={() => onOpen(null)}>
        {t("watchlist.all")}
      </Tab>

      {watchlists.map((watchlist) => (
        <WatchlistTab
          key={watchlist.id}
          watchlist={watchlist}
          displayedNewCount={Math.max(watchlist.newCount, heldNewCounts[watchlist.id] ?? 0)}
          isOpen={watchlist.id === open?.id}
          canShare={canShare}
          onOpen={() => onOpen(watchlist, watchlist.newCount)}
          onSaved={(saved) => onOpen(saved)}
          onDeleted={() => {
            if (watchlist.id === open?.id || watchlist.id === openedId) {
              onDetach();
            }
          }}
        />
      ))}

      {isFiltered && open === undefined && (
        <CurrentSearchPopover
          view={view}
          filter={filter}
          canShare={canShare}
          editable={editable}
          preferredUpdateId={preferredUpdateId}
          onOpen={() => {
            create.reset();
            update.reset();
          }}
          onSave={saveAsNew}
          onUpdate={updateExisting}
        />
      )}
    </TabStrip>
  );
}

// ---------------------------------------------------------------- tabs

interface TabProps {
  id: string;
  isOpen: boolean;
  onClick: () => void;
  children: ReactNode;
}

function Tab({ id, isOpen, onClick, children }: TabProps) {
  return (
    <TabButton data-watchlist-tab={id} onClick={onClick} selected={isOpen}>
      {children}
    </TabButton>
  );
}

interface WatchlistTabProps {
  watchlist: WatchlistSummary;
  displayedNewCount: number;
  isOpen: boolean;
  canShare: boolean;
  // Opens the watchlist as saved.
  onOpen: () => void;
  onSaved: (watchlist: Watchlist) => void;
  onDeleted: () => void;
}

// Only the open tab shows its editor trigger, so the row stays a row of names.
function WatchlistTab({
  watchlist,
  displayedNewCount,
  isOpen,
  canShare,
  onOpen,
  onSaved,
  onDeleted,
}: WatchlistTabProps) {
  const { t } = useTranslation("common");
  const { create, update, remove } = useWatchlistMutations();
  const { isEditable } = watchlist;

  return (
    <span className="inline-flex shrink-0 items-center">
      <Tab id={watchlist.id} isOpen={isOpen} onClick={onOpen}>
        {isShared(watchlist) && <SystemMark />}
        {watchlist.name}
        <span
          className="text-xs text-muted-foreground tabular-nums"
          title={t("watchlist.currentMatches")}
        >
          {watchlist.itemCount}
        </span>
        {displayedNewCount > 0 && (
          <span
            className="rounded-full bg-primary/10 px-1.5 py-0.5 text-caption font-semibold tabular-nums text-primary"
            title={t("watchlist.newIn", { count: displayedNewCount, name: watchlist.name })}
          >
            +{displayedNewCount}
            <span className="sr-only"> {t("watchlist.new")}</span>
          </span>
        )}
      </Tab>

      {isOpen && (isEditable || isShared(watchlist)) && (
        <WatchlistEditorPopover
          view={watchlist.view}
          filter={watchlist.filter}
          watchlist={watchlist}
          canShare={canShare}
          onSave={async (name, audience) => {
            const saved =
              watchlist.audience.kind === "personal" && audience.kind !== "personal"
                ? await create.mutateAsync({
                    name,
                    view: watchlist.view,
                    filter: watchlist.filter,
                    audience,
                  })
                : await update.mutateAsync({
                    watchlistId: watchlist.id,
                    change: { name, audience },
                  });
            onSaved(saved);
          }}
          onCopy={
            isShared(watchlist)
              ? async (name) => {
                  const saved = await create.mutateAsync({
                    name,
                    view: watchlist.view,
                    filter: watchlist.filter,
                    audience: { kind: "personal" },
                    copyOf: watchlist.id,
                  });
                  onSaved(saved);
                }
              : undefined
          }
          onDelete={
            isEditable
              ? async () => {
                  await remove.mutateAsync(watchlist.id);
                  onDeleted();
                }
              : undefined
          }
          trigger={
            <button
              type="button"
              aria-label={`${watchlist.name} options`}
              className="-ml-2 grid size-6 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <ChevronDown className="size-3.5" />
            </button>
          }
        />
      )}
    </span>
  );
}

function SystemMark() {
  const { t } = useTranslation("common");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span role="img" aria-label={t("watchlist.system")} className="inline-flex">
          <Building2 className="size-3.5 text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{t("watchlist.system")}</TooltipContent>
    </Tooltip>
  );
}

// Both saved tabs and Current search open the same editor popover.
interface CurrentSearchPopoverProps {
  view: WatchlistView;
  filter: Filter;
  canShare: boolean;
  editable: WatchlistSummary[];
  preferredUpdateId: string | null;
  onOpen: () => void;
  onSave: (name: string, audience: WatchlistAudience) => Promise<void>;
  onUpdate: (
    watchlist: WatchlistSummary,
    name: string,
    audience: WatchlistAudience,
  ) => Promise<void>;
}

function CurrentSearchPopover({
  view,
  filter,
  canShare,
  editable,
  preferredUpdateId,
  onOpen,
  onSave,
  onUpdate,
}: CurrentSearchPopoverProps) {
  return (
    <WatchlistEditorPopover
      view={view}
      filter={filter}
      watchlist={null}
      canShare={canShare}
      editable={editable}
      preferredUpdateId={preferredUpdateId}
      onOpen={onOpen}
      onSave={onSave}
      onUpdate={(selected) => onUpdate(selected, selected.name, selected.audience)}
      trigger={
        <button
          type="button"
          data-watchlist-tab="current"
          aria-current="page"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 border-b-2 border-primary px-3 text-ui font-medium whitespace-nowrap text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Current search
          <ChevronDown className="size-3.5" />
        </button>
      }
    />
  );
}
