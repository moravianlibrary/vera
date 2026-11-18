import { useQuery } from "@tanstack/react-query";
import type { WatchlistSummary } from "@vera/contract/watchlists";
import type { WatchlistAudience, WatchlistView } from "@vera/domain/entities";
import { isShared } from "@vera/domain/entities";
import type { Names } from "@vera/domain/names";
import { namesToSave } from "@vera/domain/names";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/http";
import { getWatchlistReach } from "@/api/watchlists";
import { NamesField } from "@/components/fields/names-field";
import {
  isEmptyWatchlistAudience,
  WatchlistAudiencePicker,
} from "@/components/filters/share-watchlist-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Filter = WatchlistSummary["filter"];

interface Props {
  view: WatchlistView;
  filter: Filter;
  watchlist: WatchlistSummary | null;
  canShare: boolean;
  trigger: ReactNode;
  onSave: (names: Names, audience: WatchlistAudience) => Promise<void>;
  onCopy?: (names: Names) => Promise<void>;
  onDelete?: () => Promise<void>;
  editable?: WatchlistSummary[];
  preferredUpdateId?: string | null;
  onUpdate?: (watchlist: WatchlistSummary) => Promise<void>;
  onOpen?: () => void;
}

export function WatchlistEditorPopover({
  view,
  filter,
  watchlist,
  canShare,
  trigger,
  onSave,
  onCopy,
  onDelete,
  editable = [],
  preferredUpdateId = null,
  onUpdate,
  onOpen,
}: Props) {
  const { t } = useTranslation("common");
  const nameId = useId();
  const targetIdLabel = useId();
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<Names>(watchlist?.names ?? {});
  const hasName = Object.values(names).some((value) => (value ?? "").trim() !== "");
  const [audience, setAudience] = useState<WatchlistAudience>(
    watchlist?.audience ?? { kind: "personal" },
  );
  const [targetId, setTargetId] = useState(preferredUpdateId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const emptyAudience = isEmptyWatchlistAudience(audience);
  const { data: reach } = useQuery({
    queryKey: ["watchlists", "reach", view, filter, audience, watchlist?.id ?? null],
    queryFn: () =>
      getWatchlistReach({ view, filter, audience, watchlistId: watchlist?.id ?? null }),
    enabled: open && audience.kind !== "personal" && !emptyAudience,
  });

  const run = async (action: () => Promise<void>, verb = "save") => {
    setPending(true);
    setError(null);
    try {
      await action();
      setOpen(false);
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? (failure.problem?.detail ??
              t(verb === "delete" ? "watchlist.deleteFailed" : "watchlist.saveFailed"))
          : t(verb === "delete" ? "watchlist.deleteFailedRetry" : "watchlist.saveFailedRetry"),
      );
    } finally {
      setPending(false);
    }
  };

  const createsSystemCopy =
    watchlist !== null && !isShared(watchlist) && audience.kind !== "personal";
  const canEdit = watchlist === null || watchlist.isEditable;
  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setNames(watchlist?.names ?? {});
          setAudience(watchlist?.audience ?? { kind: "personal" });
          setTargetId(preferredUpdateId ?? "");
          setError(null);
          setConfirmDelete(false);
          onOpen?.();
        }
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[min(80vh,42rem)] w-[min(24rem,calc(100vw-2rem))] space-y-4 overflow-y-auto p-3"
      >
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (canEdit && hasName && !emptyAudience && !pending) {
              void run(() => onSave(namesToSave(names), audience));
            }
          }}
        >
          <p className="text-xs font-medium">
            {watchlist === null
              ? t("watchlist.saveFilterAs")
              : canEdit
                ? t("watchlist.edit")
                : t("watchlist.personalCopyName")}
          </p>
          <NamesField
            id={nameId}
            label={t("watchlist.nameLabel")}
            names={names}
            onChange={setNames}
          />
          {canEdit && canShare && (
            <WatchlistAudiencePicker
              audience={audience}
              onChange={setAudience}
              view={view}
              allowPersonal={watchlist === null || !isShared(watchlist)}
            />
          )}
          {canEdit && emptyAudience && (
            <p className="text-xs text-tone-amber-foreground">{t("watchlist.pickAudience")}</p>
          )}
          {canEdit && audience.kind !== "personal" && !emptyAudience && (
            <div className="grid gap-1 text-xs text-muted-foreground">
              <p>
                {reach === undefined
                  ? t("watchlist.calculatingReach")
                  : t("watchlist.reaches", {
                      count: reach.userCount,
                      outOfViewCount: reach.outOfViewCount
                        ? `; ${t("watchlist.cannotOpen", { count: reach.outOfViewCount })}`
                        : "",
                    })}
              </p>
              {reach !== undefined && reach.duplicateCount > 0 && (
                <p className="text-tone-amber-foreground">
                  {t("watchlist.peopleKeepText", { count: reach.duplicateCount })}
                </p>
              )}
            </div>
          )}
          {createsSystemCopy && (
            <p className="text-xs text-muted-foreground">{t("watchlist.systemCopyNotice")}</p>
          )}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          {canEdit && (
            <Button type="submit" size="sm" disabled={!hasName || emptyAudience || pending}>
              {watchlist === null || createsSystemCopy
                ? t("watchlist.saveNew")
                : t("watchlist.save")}
            </Button>
          )}
        </form>

        {onCopy && (
          <div className="grid gap-2 border-t pt-3">
            <p className="text-xs text-muted-foreground">{t("watchlist.keepFilterForYourself")}</p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!hasName || pending}
              onClick={() => void run(() => onCopy(namesToSave(names)))}
            >
              {t("watchlist.savePersonalCopy")}
            </Button>
          </div>
        )}

        {onUpdate && editable.length > 0 && (
          <div className="grid gap-2 border-t pt-3">
            <Label id={targetIdLabel} className="text-xs font-medium">
              {t("watchlist.updateExisting")}
            </Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger aria-labelledby={targetIdLabel} className="w-full">
                <SelectValue placeholder={t("watchlist.choose")} />
              </SelectTrigger>
              <SelectContent>
                {editable.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editable.find((item) => item.id === targetId)?.audience.kind !== "personal" &&
              targetId && (
                <p className="text-xs text-muted-foreground">
                  {t("watchlist.confirmFilterChange")}
                </p>
              )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!targetId || pending}
              onClick={() => {
                const selected = editable.find((item) => item.id === targetId);
                if (selected) void run(() => onUpdate(selected));
              }}
            >
              {t("watchlist.update")}
            </Button>
          </div>
        )}

        {onDelete && (
          <div className="border-t pt-3">
            {confirmDelete ? (
              <div className="grid gap-2">
                <p className="text-xs">{t("watchlist.deletePrompt", { name: watchlist?.name })}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmDelete(false)}
                  >
                    {t("watchlist.keepIt")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => void run(onDelete, "delete")}
                  >
                    {t("watchlist.delete")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                {t("watchlist.delete")}
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
