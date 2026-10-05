// A view's watchlists as tabs above its filter bar (filtering.md §4): "All", the view with no
// filter, then each saved filter with what matches it now, then "+" to save the current filter.
// A tab is open while the filter is the one it saved. Changing the filter from an open tab marks
// it changed and offers Save, or Save as new; the tab's own menu renames or deletes it. The row
// scrolls sideways when it runs out of room. Grouping is never part of what is saved (§3.4).
// TODO(rrandiak): the sidebar's Watchlists row and the "new" badge (navigation.md §5,
// filtering.md §4.2–4.3); labels move to i18n.

import { ChevronDown, Plus } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import type { WatchlistSummary } from "@/api/watchlists";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Watchlist, WatchlistView } from "@/domain/entities";
import { useWatchlistMutations, useWatchlistsQuery } from "@/hooks/use-watchlists-query";
import { cn } from "@/lib/utils";

type Filter = Watchlist["filter"];

interface WatchlistTabsProps {
  view: WatchlistView;
  // The view's current filter, in its URL form.
  filter: Filter;
  // The watchlist the filter was opened from, if any; it stays open while the filter changes.
  openedId: string | null;
  isSameFilter: (first: Filter, second: Filter) => boolean;
  // Null opens "All".
  onOpen: (watchlist: Watchlist | null) => void;
  // The open watchlist is gone; the filter stays as it is.
  onDetach: () => void;
}

export function WatchlistTabs({
  view,
  filter,
  openedId,
  isSameFilter,
  onOpen,
  onDetach,
}: WatchlistTabsProps) {
  const { data: watchlists = [] } = useWatchlistsQuery(view);
  const { create, update } = useWatchlistMutations();
  const open =
    openedId === null
      ? watchlists.find((watchlist) => isSameFilter(watchlist.filter, filter))
      : watchlists.find((watchlist) => watchlist.id === openedId);
  const isFiltered = Object.keys(filter).length > 0;
  const isChanged = open !== undefined && !isSameFilter(open.filter, filter);

  const saveAsNew = async (name: string) => {
    const created = await create.mutateAsync({ name, view, filter });
    onOpen(created);
  };

  return (
    <div className="flex shrink-0 items-end border-b px-4 sm:px-6">
      <nav
        aria-label="Watchlists"
        className="-mb-px flex min-w-0 flex-1 items-end overflow-x-auto [scrollbar-width:thin]"
      >
        <Tab isOpen={open === undefined && !isFiltered} onClick={() => onOpen(null)}>
          All
        </Tab>

        {watchlists.map((watchlist) => (
          <WatchlistTab
            key={watchlist.id}
            watchlist={watchlist}
            isOpen={watchlist.id === open?.id}
            isChanged={watchlist.id === open?.id && isChanged}
            onOpen={() => onOpen(watchlist)}
            onDeleted={() => {
              if (watchlist.id === open?.id) {
                onDetach();
              }
            }}
          />
        ))}

        <SaveWatchlistPopover
          isSaving={create.isPending}
          onSave={saveAsNew}
          trigger={
            <button
              type="button"
              aria-label="Save this filter as a watchlist"
              title={isFiltered ? "Save this filter as a watchlist" : "Filter the list first"}
              disabled={!isFiltered}
              className="mb-1 ml-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          }
        />
      </nav>

      {isChanged && (
        <div className="flex shrink-0 items-center gap-1.5 py-1.5 pl-3">
          <Button
            size="xs"
            disabled={update.isPending}
            onClick={() => update.mutate({ watchlistId: open.id, change: { filter } })}
          >
            Save
          </Button>
          <SaveWatchlistPopover
            isSaving={create.isPending}
            onSave={saveAsNew}
            trigger={
              <Button size="xs" variant="outline">
                Save as new
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- tabs

interface TabProps {
  isOpen: boolean;
  onClick: () => void;
  children: ReactNode;
}

function Tab({ isOpen, onClick, children }: TabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isOpen ? "page" : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 border-b-2 px-3 text-[0.8125rem] whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        isOpen
          ? "border-primary font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

interface WatchlistTabProps {
  watchlist: WatchlistSummary;
  isOpen: boolean;
  isChanged: boolean;
  onOpen: () => void;
  onDeleted: () => void;
}

// Only the open tab shows its menu, so the row stays a row of names.
function WatchlistTab({ watchlist, isOpen, isChanged, onOpen, onDeleted }: WatchlistTabProps) {
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const { update, remove } = useWatchlistMutations();

  return (
    <span className="inline-flex shrink-0 items-center">
      <Tab isOpen={isOpen} onClick={onOpen}>
        {watchlist.name}
        <span className="text-xs text-muted-foreground tabular-nums">{watchlist.itemCount}</span>
        {isChanged && (
          <span
            role="img"
            aria-label="changed"
            title="The filter has changed since it was saved"
            className="size-1.5 rounded-full bg-tone-amber-foreground"
          />
        )}
      </Tab>

      {isOpen && (
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

      <RenameWatchlistDialog
        isOpen={dialog === "rename"}
        name={watchlist.name}
        isSaving={update.isPending}
        onClose={() => setDialog(null)}
        onRename={async (name) => {
          await update.mutateAsync({ watchlistId: watchlist.id, change: { name } });
          setDialog(null);
        }}
      />

      <AlertDialog
        open={dialog === "delete"}
        onOpenChange={(isDialogOpen) => setDialog(isDialogOpen ? "delete" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{watchlist.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The saved filter goes; the documents it matched stay where they are.
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

// ---------------------------------------------------------------- naming

interface SaveWatchlistPopoverProps {
  isSaving: boolean;
  onSave: (name: string) => Promise<void>;
  trigger: ReactNode;
}

function SaveWatchlistPopover({ isSaving, onSave, trigger }: SaveWatchlistPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <NameForm
          label="Save this filter as a watchlist"
          submitLabel="Save watchlist"
          isSaving={isSaving}
          onSubmit={async (name) => {
            await onSave(name);
            setIsOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

interface RenameWatchlistDialogProps {
  isOpen: boolean;
  name: string;
  isSaving: boolean;
  onClose: () => void;
  onRename: (name: string) => Promise<void>;
}

function RenameWatchlistDialog({
  isOpen,
  name,
  isSaving,
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
  onSubmit: (name: string) => Promise<void>;
  footer?: (props: { children: ReactNode }) => ReactNode;
}

function NameForm({
  label,
  initialName = "",
  submitLabel,
  isSaving,
  onSubmit,
  footer: Footer = PlainFooter,
}: NameFormProps) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed === "" || isSaving) {
      return;
    }

    void onSubmit(trimmed);
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
