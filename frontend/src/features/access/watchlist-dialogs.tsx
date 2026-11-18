// What is done to a shared watchlist from Users & Groups (view-catalog.md *Shared watchlists*;
// filtering.md §4.5), under `watchlist.manage_system`: who sees it, its name, and deleting it,
// which says first how many people lose it. Its filter is edited in its own view, opened on it.

import type { SharedWatchlist } from "@vera/contract/access";
import type { WatchlistAudience } from "@vera/domain/entities";
import type { Names } from "@vera/domain/names";
import { namesToSave } from "@vera/domain/names";
import { useId } from "react";
import { z } from "zod";
import { deleteWatchlist, updateWatchlist } from "@/api/watchlists";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { NamesField } from "@/components/fields/names-field";
import { ShareWatchlistDialog } from "@/components/filters/share-watchlist-dialog";
import { FieldError } from "@/components/iteration-dialogs";
import { navigationEntries } from "@/components/layout/navigation";
import type { AccessNotice } from "@/features/access/access-dialogs";
import { accessQueryKey } from "@/features/access/use-access-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";
import { i18n } from "@/i18n";

const t = (key: string, options?: Record<string, unknown>) =>
  i18n.t(key, { ns: "access", ...options });

const invalidates = [accessQueryKey, watchlistsQueryKey] as const;

const refusalTexts = {
  403: t("watchlist.refusal.forbidden"),
  409: t("watchlist.refusal.duplicate"),
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
                ? t("watchlist.personalNow")
                : t("watchlist.audienceChanged"),
          });
        }

        return result;
      }}
    />
  );
}

const nameSchema = z.object({
  names: z
    .object({ cs: z.string().optional(), en: z.string().optional() })
    .refine((names) => Object.values(names).some((name) => (name ?? "").trim() !== ""), {
      message: t("watchlist.nameRequired"),
      path: ["cs"],
    }),
});

export function RenameSharedWatchlistDialog({ onClose, watchlist, onDone }: WatchlistDialogProps) {
  const id = useId();
  const rename = useActionMutation({
    call: (names: Names) => updateWatchlist(watchlist.id, { names: namesToSave(names) }),
    invalidates,
    refusalTexts,
  });
  return (
    <FormDialog
      isOpen
      onClose={onClose}
      title={t("watchlist.renameTitle", { name: watchlist.name })}
      description={t("watchlist.renameDescription")}
      schema={nameSchema}
      defaultValues={{ names: watchlist.names }}
      submitLabel={t("watchlist.rename")}
      onSubmit={async ({ names }) => {
        const result = await rename.run(names);
        if (result.isDone) {
          onDone({
            title: t("watchlist.renamed"),
            text: t("watchlist.renamedDescription", {
              name: names[i18n.language.startsWith("cs") ? "cs" : "en"] ?? watchlist.name,
            }),
          });
        }

        return result;
      }}
      render={(form) => (
        <>
          <NamesField
            id={`${id}-name`}
            label={t("watchlist.name")}
            names={form.watch("names")}
            onChange={(names) => form.setValue("names", names, { shouldDirty: true })}
          />
          <FieldError
            message={
              form.formState.errors.names?.cs?.message ?? form.formState.errors.names?.en?.message
            }
          />
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
      title={t("watchlist.deleteTitle", { name: watchlist.name })}
      description={t("watchlist.deleteDescription", { name: watchlist.name })}
      consequences={[
        {
          text: t("watchlist.deleteReachedPeople", { count: watchlist.reachedUserIds.length }),
          tone: "amber",
        },
        { text: t("watchlist.deleteRecordsStay") },
      ]}
      confirmLabel={t("watchlist.delete")}
      isDestructive
      onConfirm={async () => {
        const result = await remove.run(watchlist.id);
        if (result.isDone) {
          onDone({
            title: t("watchlist.deleted", { name: watchlist.name }),
            text: t("watchlist.nobodySeesIt"),
          });
        }

        return result;
      }}
    />
  );
}
