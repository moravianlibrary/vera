// What is done to an intention's mix (intentions.md §1.1, §2.2, §2.3, §2.5; docs/demos/shared/
// page-categories.js `editShares`, `detach`). *Edit proportions…* writes one sibling set whole on
// the intention that owns the mix: empty is no share, allowed and flagged; 0 is deliberately
// excluded; over 100 cannot be saved. When others track the mix, Save first lists every one of
// them, archived and ended too, since they all change with it; *Keep the old mix* detaches one
// onto its own copy first, offered only where the person may edit that tracker (decided
// 2026-10-07, replacing "unticked trackers keep it together under the longest"). *Detach* gives
// a tracker its own copy and changes nobody else.
// TODO(rrandiak): labels move to i18n.

import { useState } from "react";
import type { IntentionMixDetail, MixTracker } from "@/api/mixes";
import { detachIntention, saveMixSet } from "@/api/mixes";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { SetEditorDialog } from "@/components/dialogs/set-editor-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { Category, Intention } from "@/domain/entities";
import { intentionInvalidations } from "@/features/intentions/use-intentions-query";
import type { Refusal } from "@/hooks/use-action-mutation";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { formatPercent } from "@/lib/format-number";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";

const refusalTexts = {
  "mix.revision": "Somebody changed this mix meanwhile. Close this and open it again.",
  "mix.over": "A set cannot pass 100.",
  "intention.not_owner": "It tracks another's mix now; edit that one.",
  403: "You may no longer change this mix.",
} as const;

// One child as typed: empty for no share.
interface ShareEntry {
  categoryId: string;
  name: string;
  text: string;
}

const shareOf = (text: string): number | null => (text.trim() === "" ? null : Number(text));
const isShareText = (text: string) => {
  const share = shareOf(text);
  return share === null || (Number.isFinite(share) && share >= 0 && share <= 100);
};
const sumOf = (entries: readonly ShareEntry[]) =>
  entries.reduce((sum, entry) => sum + (shareOf(entry.text) ?? 0), 0);

const stateTextOf = (tracker: MixTracker) =>
  tracker.intention.archived === null ? tracker.state.toLowerCase() : "archived";

interface ProportionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categories: readonly Category[];
  detail: IntentionMixDetail;
  // The set's parent; null is the top level.
  parentId: string | null;
  // Whether the person may detach that tracker, which keeping the old mix does.
  canKeepOldFor: (tracker: Intention) => boolean;
  onSaved: (saved: IntentionMixDetail, keptCount: number) => void;
}

export function ProportionsDialog({
  isOpen,
  onClose,
  categories,
  detail,
  parentId,
  canKeepOldFor,
  onSaved,
}: ProportionsDialogProps) {
  const { mix, trackers } = detail;
  const { owner } = mix;
  const [keptIds, setKeptIds] = useState<ReadonlySet<string>>(new Set());
  const save = useActionMutation({
    call: (entries: readonly ShareEntry[]) =>
      saveMixSet(owner.id, {
        parentId,
        shares: Object.fromEntries(entries.map((entry) => [entry.categoryId, shareOf(entry.text)])),
        revision: detail.revision,
        keepOldMixFor: [...keptIds],
      }),
    invalidates: intentionInvalidations,
    refusalTexts,
  });
  const parent = categories.find((category) => category.id === parentId);
  const scope = categories.find((category) => category.id === mix.intention.scopeCategoryId);
  const isScope = parent !== undefined && parent.id === scope?.id;
  // What the set divides, of the whole or of the scope.
  const base =
    parentId === null || isScope
      ? 100
      : (mix.nodes.find((node) => node.categoryId === parentId)?.ofWhole ?? 0);
  const ofWhat = scope === undefined ? "the whole" : scope.name;
  const entries: ShareEntry[] = categories
    .filter((category) => category.parentId === parentId)
    .map((category) => {
      const share = mix.nodes.find((node) => node.categoryId === category.id)?.share ?? null;
      return {
        categoryId: category.id,
        name: category.name,
        text: share === null ? "" : String(share),
      };
    });
  const kept = trackers.filter((tracker) => keptIds.has(tracker.intention.id));
  const changing = trackers.length - kept.length;

  return (
    <SetEditorDialog
      isOpen={isOpen}
      onClose={() => {
        setKeptIds(new Set());
        onClose();
      }}
      title={`Proportions — ${parent?.name ?? "top level"}`}
      description={`One sibling set of ${owner.name}'s mix, saved whole.`}
      entries={entries}
      renderEntries={(current, onChange) => (
        <>
          <p className="text-xs text-muted-foreground">
            {owner.name}&apos;s mix ·{" "}
            {parent === undefined || isScope
              ? `the set splits 100% of ${ofWhat}`
              : `each child's share of ${parent.name}, which is ${formatPercent(base)} of ${ofWhat}`}
          </p>
          <table className="w-full text-sm">
            <tbody>
              {current.map((entry, position) => {
                const share = shareOf(entry.text);
                return (
                  <tr key={entry.categoryId} className="border-b last:border-0">
                    <td className="py-2 font-medium">
                      <label htmlFor={`share-${entry.categoryId}`}>{entry.name}</label>
                    </td>
                    <td className="w-32 py-2">
                      <span className="flex items-center gap-1.5">
                        <Input
                          id={`share-${entry.categoryId}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          placeholder="—"
                          className="h-8 w-20 text-right tabular-nums"
                          value={entry.text}
                          onChange={(event) =>
                            onChange(
                              current.map((candidate, index) =>
                                index === position
                                  ? { ...candidate, text: event.target.value }
                                  : candidate,
                              ),
                            )
                          }
                        />
                        %
                      </span>
                    </td>
                    <td className="py-2 text-right text-xs text-muted-foreground tabular-nums">
                      {share === null || !isShareText(entry.text)
                        ? "no share"
                        : `${formatPercent((base * share) / 100)} of ${ofWhat}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      summaryOf={(current) => {
        const sum = sumOf(current);
        return (
          <>
            {current.every((entry) => isShareText(entry.text)) && sum <= 100 && (
              <p
                className={cn(
                  "text-xs font-medium",
                  sum < 100 ? "text-tone-amber-foreground" : "text-tone-green-foreground",
                )}
              >
                {sum < 100
                  ? `${formatPercent(sum)} — ${formatPercent(100 - sum)} unallocated. Allowed: generation allocates ${formatPercent(sum)} and reports the rest.`
                  : "100% — complete."}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              The set is saved whole: changing one share is deciding where the difference comes
              from. Empty means <b className="font-semibold">no share</b> — allowed, and flagged.{" "}
              <b className="font-semibold">0</b> means deliberately excluded.
              {trackers.length > 0 &&
                ` ${plural(trackers.length, "other intention tracks", "other intentions track")} this mix; saving lists them first.`}
            </p>
          </>
        );
      }}
      invalidReasonOf={(current) => {
        if (!current.every((entry) => isShareText(entry.text))) {
          return "Each share is between 0 and 100.";
        }

        const sum = sumOf(current);
        return sum > 100
          ? `${formatPercent(sum)} — over by ${formatPercent(sum - 100)}. A set cannot pass 100.`
          : null;
      }}
      reachOf={() =>
        trackers.length === 0
          ? null
          : {
              body: (
                <TrackersReach
                  owner={owner}
                  trackers={trackers}
                  keptIds={keptIds}
                  canKeepOldFor={canKeepOldFor}
                  onKeptChange={setKeptIds}
                />
              ),
              submitLabel:
                changing === 0
                  ? `Save for ${owner.name} only`
                  : `Save for ${owner.name} and ${changing} more`,
            }
      }
      submitLabel="Save the set"
      onSave={async (current) => {
        const result = await save.run(current);
        if (result.isDone) {
          onSaved(result.value, kept.length);
          setKeptIds(new Set());
        }

        return result;
      }}
    />
  );
}

interface TrackersReachProps {
  owner: Intention;
  trackers: readonly MixTracker[];
  keptIds: ReadonlySet<string>;
  canKeepOldFor: (tracker: Intention) => boolean;
  onKeptChange: (next: ReadonlySet<string>) => void;
}

// §2.3: whom the edit reaches, each with *Keep the old mix*.
function TrackersReach({
  owner,
  trackers,
  keptIds,
  canKeepOldFor,
  onKeptChange,
}: TrackersReachProps) {
  const kept = trackers.filter((tracker) => keptIds.has(tracker.intention.id));
  const toggle = (intentionId: string, isKept: boolean) => {
    const next = new Set(keptIds);
    if (isKept) {
      next.add(intentionId);
    } else {
      next.delete(intentionId);
    }

    onKeptChange(next);
  };

  return (
    <div className="grid gap-3 text-sm">
      <p>
        Change the mix of <b className="font-semibold">{owner.name}</b>? These intentions track it
        and change with it:
      </p>
      <ul className="grid divide-y rounded-md border">
        {trackers.map((tracker) => {
          const { intention } = tracker;
          const checkboxId = `keep-${intention.id}`;
          return (
            <li
              key={intention.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2"
            >
              <span className="min-w-0">
                <b className="font-semibold">{intention.name}</b>{" "}
                <span className="text-muted-foreground">
                  · {intention.targetPages === null ? "tracking" : "target"} ·{" "}
                  {stateTextOf(tracker)}
                </span>
              </span>
              {canKeepOldFor(intention) && (
                <label htmlFor={checkboxId} className="flex items-center gap-2 text-xs">
                  <Checkbox
                    id={checkboxId}
                    checked={keptIds.has(intention.id)}
                    onCheckedChange={(checked) => toggle(intention.id, checked === true)}
                  />
                  Keep the old mix
                </label>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs">
        {kept.length === 0
          ? "Every one of them changes with it."
          : `${kept.map((tracker) => tracker.intention.name).join(", ")} will be detached onto ${kept.length === 1 ? "its" : "their"} own copy of the mix as it is now, before the change.`}
      </p>
      <p className="text-xs text-muted-foreground">
        A window that is closed counts against the mix as it was, so the edit never rewrites a
        closed result.
      </p>
    </div>
  );
}

interface DetachDialogProps {
  isOpen: boolean;
  onClose: () => void;
  intention: Intention;
  owner: Intention;
  onDetached: (detached: IntentionMixDetail) => void;
}

export function DetachDialog({ isOpen, onClose, intention, owner, onDetached }: DetachDialogProps) {
  const detach = useActionMutation({
    call: () => detachIntention(intention.id),
    invalidates: intentionInvalidations,
    refusalTexts: { 403: "You may no longer change this intention." },
  });
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  return (
    <DialogShell
      isOpen={isOpen}
      onClose={() => {
        setRefusal(null);
        onClose();
      }}
      title={`Detach ${intention.name}?`}
      description={`${intention.name} gets its own copy of ${owner.name}'s mix.`}
      refusal={refusal}
      primary={{
        label: "Detach",
        isPending: detach.isPending,
        onSelect: () =>
          void detach.run(undefined).then((result) => {
            if (result.isDone) {
              onDetached(result.value);
              onClose();
              return;
            }

            setRefusal(result.refusal);
          }),
      }}
    >
      <p className="text-sm">
        It gets its own copy of {owner.name}&apos;s mix, as it is now, and stops changing with{" "}
        {owner.name}. Nothing changes for anyone else; its proportions are then edited here.
      </p>
    </DialogShell>
  );
}
