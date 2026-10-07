// What is done to a shared watchlist from Users & Groups (view-catalog.md *Shared watchlists*;
// filtering.md §4.5), under `watchlist.manage_shared`: who sees it, its name, and deleting it,
// which says first how many people lose it. Its filter is edited in its own view, opened on it.
// TODO(rrandiak): labels move to i18n.

import { useId } from "react";
import { z } from "zod";
import type { SharedWatchlist } from "@/api/access";
import { deleteWatchlist, updateWatchlist } from "@/api/watchlists";
import { Field } from "@/components/classification-fields";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { ShareWatchlistDialog } from "@/components/filters/share-watchlist-dialog";
import { FieldError } from "@/components/iteration-dialogs";
import { navigationEntries } from "@/components/layout/navigation";
import { Input } from "@/components/ui/input";
import type { WatchlistAudience } from "@/domain/entities";
import type { AccessNotice } from "@/features/access/access-dialogs";
import { accessQueryKey } from "@/features/access/use-access-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";
import { plural } from "@/lib/plural";

const invalidates = [accessQueryKey, watchlistsQueryKey] as const;

const refusalTexts = {
  403: "Only those who manage shared watchlists change them.",
  409: "Another watchlist the people it reaches see already holds this.",
};

interface WatchlistDialogProps {
  onClose: () => void;
  watchlist: SharedWatchlist;
  onDone: (notice: AccessNotice) => void;
}

// The view, opened on the watchlist's filter, where the filter is changed and saved on its tab.
export function watchlistHrefOf(watchlist: SharedWatchlist): string {
  const path = navigationEntries.find((entry) => entry.id === watchlist.view)?.path ?? "/";
  const params = new URLSearchParams(watchlist.filter);
  params.set("watchlist", watchlist.id);
  return `${path}?${params}`;
}

export function ShareSharedWatchlistDialog({ onClose, watchlist, onDone }: WatchlistDialogProps) {
  const share = useActionMutation({
    call: (audience: WatchlistAudience) => updateWatchlist(watchlist.id, { audience }),
    invalidates,
    refusalTexts,
  });
  return (
    <ShareWatchlistDialog
      isOpen
      onClose={onClose}
      watchlist={watchlist}
      onSave={async (audience) => {
        const result = await share.run(audience);
        if (result.isDone) {
          onDone({
            title: `“${watchlist.name}” shared`,
            text:
              audience.kind === "personal"
                ? "It is your own now; nobody else sees it."
                : "Who sees it changed.",
          });
        }

        return result;
      }}
    />
  );
}

const nameSchema = z.object({ name: z.string().trim().min(1, "Give it a name") });

export function RenameSharedWatchlistDialog({ onClose, watchlist, onDone }: WatchlistDialogProps) {
  const id = useId();
  const rename = useActionMutation({
    call: (name: string) => updateWatchlist(watchlist.id, { name }),
    invalidates,
    refusalTexts,
  });
  return (
    <FormDialog
      isOpen
      onClose={onClose}
      title={`Rename “${watchlist.name}”`}
      description="The shared watchlist's name"
      schema={nameSchema}
      defaultValues={{ name: watchlist.name }}
      submitLabel="Rename"
      onSubmit={async ({ name }) => {
        const result = await rename.run(name);
        if (result.isDone) {
          onDone({ title: "Watchlist renamed", text: `It is “${name}” for everyone who sees it.` });
        }

        return result;
      }}
      render={(form) => (
        <>
          <Field id={`${id}-name`} label="Name">
            <Input id={`${id}-name`} {...form.register("name")} />
          </Field>
          <FieldError message={form.formState.errors.name?.message} />
        </>
      )}
    />
  );
}

export function DeleteSharedWatchlistDialog({ onClose, watchlist, onDone }: WatchlistDialogProps) {
  const remove = useActionMutation({ call: deleteWatchlist, invalidates, refusalTexts });
  return (
    <ConsequenceDialog
      isOpen
      onClose={onClose}
      title={`Delete “${watchlist.name}”?`}
      description={`What deleting the shared watchlist ${watchlist.name} does`}
      consequences={[
        {
          text: `It goes from the tabs of the ${plural(watchlist.reachedUserIds.length, "person", "people")} who see it.`,
          tone: "amber",
        },
        { text: "The records it matched stay where they are." },
      ]}
      confirmLabel="Delete watchlist"
      isDestructive
      onConfirm={async () => {
        const result = await remove.run(watchlist.id);
        if (result.isDone) {
          onDone({ title: `“${watchlist.name}” deleted`, text: "Nobody sees it any more." });
        }

        return result;
      }}
    />
  );
}
