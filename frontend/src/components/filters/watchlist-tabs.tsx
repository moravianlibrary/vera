// A view's watchlists above its filter bar: All, the shared and personal saved filters, and
// Current search when the full current filter matches none of them. Changing search or any field
// selects the matching saved tab, or Current search; that tab can save a new watchlist or replace
// an editable one's filter. A bare view reopens the last saved tab. Grouping is not saved.
// New-entry badges and per-person seen state follow watchlists-and-notifications.md.

import type { WatchlistSummary } from "@vera/contract/watchlists";
import { isSameWatchlistFilter } from "@vera/contract/watchlists";
import type { Watchlist, WatchlistAudience, WatchlistView } from "@vera/domain/entities";
import { isShared } from "@vera/domain/entities";
import { Building2, ChevronDown, CircleAlert } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { ApiError } from "@/api/http";
import { createWatchlist, updateWatchlist } from "@/api/watchlists";
import { ShareWatchlistDialog } from "@/components/filters/share-watchlist-dialog";
import { TabButton, TabStrip } from "@/components/filters/tab-strip";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useRememberedWatchlist } from "@/hooks/use-remembered-watchlist";
import {
  useWatchlistMutations,
  useWatchlistsQuery,
  watchlistsQueryKey,
} from "@/hooks/use-watchlists-query";

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

  const updateExisting = async (watchlistId: string) => {
    const saved = await update.mutateAsync({ watchlistId, change: { filter } });
    onOpen(saved);
  };

  return (
    <TabStrip label="Watchlists" navRef={navRef}>
      <Tab id="all" isOpen={open === undefined && !isFiltered} onClick={() => onOpen(null)}>
        All
      </Tab>

      {watchlists.map((watchlist) => (
        <WatchlistTab
          key={watchlist.id}
          watchlist={watchlist}
          displayedNewCount={Math.max(watchlist.newCount, heldNewCounts[watchlist.id] ?? 0)}
          isOpen={watchlist.id === open?.id}
          canShare={canShare}
          onOpen={() => onOpen(watchlist, watchlist.newCount)}
          onDeleted={() => {
            if (watchlist.id === open?.id || watchlist.id === openedId) {
              onDetach();
            }
          }}
        />
      ))}

      {isFiltered && open === undefined && (
        <CurrentSearchPopover
          canShare={canShare}
          editable={editable}
          preferredUpdateId={preferredUpdateId}
          isSaving={create.isPending}
          saveError={create.error}
          isUpdating={update.isPending}
          updateError={update.error}
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
  onDeleted: () => void;
}

// Only the open tab shows its menu, so the row stays a row of names.
function WatchlistTab({
  watchlist,
  displayedNewCount,
  isOpen,
  canShare,
  onOpen,
  onDeleted,
}: WatchlistTabProps) {
  const [dialog, setDialog] = useState<"rename" | "share" | "delete" | null>(null);
  const share = useActionMutation({
    call: (audience: WatchlistAudience) =>
      isShared(watchlist)
        ? updateWatchlist(watchlist.id, { audience })
        : createWatchlist({
            name: watchlist.name,
            view: watchlist.view,
            filter: watchlist.filter,
            audience,
          }),
    invalidates: [watchlistsQueryKey],
    refusalTexts: {
      403: "Only watchlist managers can create system watchlists or change audiences.",
    },
  });
  const { update, remove } = useWatchlistMutations();
  const { isEditable } = watchlist;
  const isShareable = canShare && isEditable;
  // A refused rename shows in its dialog; a refused delete shows beside the tab.
  const failure = dialog === "rename" ? null : remove.error;

  return (
    <span className="inline-flex shrink-0 items-center">
      <Tab id={watchlist.id} isOpen={isOpen} onClick={onOpen}>
        {isShared(watchlist) && <SystemMark />}
        {watchlist.name}
        <span className="text-xs text-muted-foreground tabular-nums" title="Current matches">
          {watchlist.itemCount}
        </span>
        {displayedNewCount > 0 && (
          <span
            className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-primary"
            title={`${displayedNewCount} new in ${watchlist.name}`}
          >
            +{displayedNewCount}
            <span className="sr-only"> new</span>
          </span>
        )}
      </Tab>

      {isOpen && isEditable && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`${watchlist.name} options`}
            className="-ml-2 grid size-6 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem className="text-xs" onSelect={() => setDialog("rename")}>
              Rename
            </DropdownMenuItem>
            {isShareable && (
              <DropdownMenuItem className="text-xs" onSelect={() => setDialog("share")}>
                {isShared(watchlist) ? "Change audience…" : "Create system watchlist…"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              className="text-xs"
              onSelect={() => setDialog("delete")}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {failure !== null && <Refusal error={failure} />}

      <RenameWatchlistDialog
        isOpen={dialog === "rename"}
        name={watchlist.name}
        isSaving={update.isPending}
        error={update.error}
        onClose={() => {
          setDialog(null);
          update.reset();
        }}
        onRename={async (name) => {
          await update.mutateAsync({ watchlistId: watchlist.id, change: { name } });
          setDialog(null);
        }}
      />

      {dialog === "share" && (
        <ShareWatchlistDialog
          isOpen
          onClose={() => setDialog(null)}
          watchlist={watchlist}
          mode={isShared(watchlist) ? "audience" : "publish"}
          onSave={share.run}
        />
      )}

      <AlertDialog
        open={dialog === "delete"}
        onOpenChange={(isDialogOpen) => setDialog(isDialogOpen ? "delete" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{watchlist.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The saved filter goes
              {isShared(watchlist) ? ", for everyone who sees it" : ""}; the documents it matched
              stay where they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await remove.mutateAsync(watchlist.id);
                onDeleted();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  );
}

// What the server refused, kept beside the tab until the next try.
function Refusal({ error }: { error: Error }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span role="img" aria-label={refusalOf(error)} className="inline-flex">
          <CircleAlert className="size-3.5 text-destructive" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{refusalOf(error)}</TooltipContent>
    </Tooltip>
  );
}

const forbiddenStatus = 403;
const conflictStatus = 409;

function refusalOf(error: Error): string {
  if (error instanceof ApiError && error.status === conflictStatus) {
    return "The filter is already saved as another watchlist.";
  }

  if (error instanceof ApiError && error.status === forbiddenStatus) {
    return "Only watchlist managers can change system watchlists.";
  }

  return "The watchlist could not be saved. Try again.";
}

function SystemMark() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span role="img" aria-label="System watchlist" className="inline-flex">
          <Building2 className="size-3.5 text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent>System watchlist</TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------- naming

// A new watchlist is the caller's own or everyone's; groups and roles are chosen with Share….
const newAudiences = ["personal", "everyone"] as const;
type NewAudience = (typeof newAudiences)[number];

const newAudienceLabels = {
  personal: "Only me",
  everyone: "Everyone",
} as const satisfies Record<NewAudience, string>;

interface CurrentSearchPopoverProps {
  canShare: boolean;
  editable: WatchlistSummary[];
  preferredUpdateId: string | null;
  isSaving: boolean;
  saveError: Error | null;
  isUpdating: boolean;
  updateError: Error | null;
  // Clears what the last try was refused.
  onOpen: () => void;
  onSave: (name: string, audience: WatchlistAudience) => Promise<void>;
  onUpdate: (watchlistId: string) => Promise<void>;
}

function CurrentSearchPopover({
  canShare,
  editable,
  preferredUpdateId,
  isSaving,
  saveError,
  isUpdating,
  updateError,
  onOpen,
  onSave,
  onUpdate,
}: CurrentSearchPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<NewAudience>("personal");
  const [targetId, setTargetId] = useState(preferredUpdateId ?? "");
  const scopeId = useId();
  const targetLabelId = useId();

  return (
    <Popover
      open={isOpen}
      onOpenChange={(isPopoverOpen) => {
        setIsOpen(isPopoverOpen);
        setScope("personal");
        if (isPopoverOpen) {
          setTargetId(preferredUpdateId ?? "");
        }
        onOpen();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          data-watchlist-tab="current"
          aria-current="page"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 border-b-2 border-primary px-3 text-[0.8125rem] font-medium whitespace-nowrap text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Current search
          <ChevronDown className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4 p-3">
        <NameForm
          label="Save this filter as a watchlist"
          submitLabel="Save new watchlist"
          isSaving={isSaving}
          error={saveError}
          onSubmit={async (name) => {
            await onSave(name, { kind: scope });
            setIsOpen(false);
          }}
        >
          {canShare && (
            <RadioGroup
              aria-label="Who sees it"
              value={scope}
              onValueChange={(value) => {
                const picked = newAudiences.find((option) => option === value);
                if (picked !== undefined) {
                  setScope(picked);
                }
              }}
              className="flex gap-4"
            >
              {newAudiences.map((option) => (
                <div key={option} className="flex items-center gap-1.5">
                  <RadioGroupItem id={`${scopeId}-${option}`} value={option} />
                  <Label htmlFor={`${scopeId}-${option}`} className="text-xs font-normal">
                    {newAudienceLabels[option]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        </NameForm>
        {editable.length > 0 && (
          <div className="grid gap-2 border-t pt-3">
            <Label id={targetLabelId} className="text-xs font-medium">
              Update an existing watchlist
            </Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger aria-labelledby={targetLabelId} className="w-full">
                <SelectValue placeholder="Choose a watchlist" />
              </SelectTrigger>
              <SelectContent>
                {editable.map((watchlist) => (
                  <SelectItem key={watchlist.id} value={watchlist.id}>
                    {watchlist.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(() => {
              const selected = editable.find((watchlist) => watchlist.id === targetId);
              return selected !== undefined && isShared(selected) ? (
                <p className="text-xs text-muted-foreground">
                  {selected.subscriberCount} subscriber{selected.subscriberCount === 1 ? "" : "s"}{" "}
                  will be notified and must confirm the changed filter before delivery resumes.
                </p>
              ) : null;
            })()}
            {updateError !== null && (
              <p className="text-xs text-destructive">{refusalOf(updateError)}</p>
            )}
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={targetId === "" || isUpdating}
                onClick={() => {
                  onUpdate(targetId)
                    .then(() => setIsOpen(false))
                    .catch(() => undefined);
                }}
              >
                Update watchlist
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface RenameWatchlistDialogProps {
  isOpen: boolean;
  name: string;
  isSaving: boolean;
  error: Error | null;
  onClose: () => void;
  onRename: (name: string) => Promise<void>;
}

function RenameWatchlistDialog({
  isOpen,
  name,
  isSaving,
  error,
  onClose,
  onRename,
}: RenameWatchlistDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(isDialogOpen) => {
        if (!isDialogOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename the watchlist</DialogTitle>
        </DialogHeader>
        <NameForm
          label="Name"
          initialName={name}
          submitLabel="Rename"
          isSaving={isSaving}
          error={error}
          onSubmit={onRename}
          footer={DialogFooter}
        />
      </DialogContent>
    </Dialog>
  );
}

interface NameFormProps {
  label: string;
  initialName?: string;
  submitLabel: string;
  isSaving: boolean;
  // What the server refused on the last try.
  error: Error | null;
  onSubmit: (name: string) => Promise<void>;
  footer?: (props: { children: ReactNode }) => ReactNode;
  // More fields, between the name and the button.
  children?: ReactNode;
}

function NameForm({
  label,
  initialName = "",
  submitLabel,
  isSaving,
  error,
  onSubmit,
  footer: Footer = PlainFooter,
  children,
}: NameFormProps) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed === "" || isSaving) {
      return;
    }

    // A refusal stays in the mutation and shows below; the form stays open for another try.
    onSubmit(trimmed).catch(() => undefined);
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      <Input
        aria-label={label}
        placeholder="Watchlist name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="h-8"
        autoFocus
      />
      {children}
      {error !== null && <p className="text-xs text-destructive">{refusalOf(error)}</p>}
      <Footer>
        <Button type="submit" size="sm" disabled={trimmed === "" || isSaving}>
          {submitLabel}
        </Button>
      </Footer>
    </form>
  );
}

function PlainFooter({ children }: { children: ReactNode }) {
  return <div className="flex justify-end">{children}</div>;
}
