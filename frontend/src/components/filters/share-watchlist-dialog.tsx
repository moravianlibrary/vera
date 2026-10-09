// Who sees a watchlist (filtering.md §4.5; component-interfaces.md §6.6 *Share watchlist…*): its
// owner alone, everyone who opens the view, or the members of some groups and the holders of some
// roles. Before it is saved it says, from the server, how many people the audience reaches, how
// many in it cannot open the view, and how many of the reached already keep the same filter as
// their own, which warns rather than refuses (decided 2026-10-06). Opened from a watchlist's tab
// and from its record on Users & Groups, under `watchlist.manage_shared`.
// TODO(rrandiak): from Preferences → Watchlists (plan.md step 12); labels move to i18n.

import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { getWatchlistReach } from "@/api/watchlists";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Watchlist, WatchlistAudience } from "@/domain/entities";
import type { ActionResult, Refusal } from "@/hooks/use-action-mutation";
import { useGroupsQuery, useRolesQuery } from "@/hooks/use-reference-query";
import { plural } from "@/lib/plural";

const audienceKinds = ["personal", "everyone", "some"] as const;
type AudienceKind = (typeof audienceKinds)[number];

const audienceLabels = {
  personal: "Only me",
  everyone: "Everyone who opens the view",
  some: "Some groups and roles",
} as const satisfies Record<AudienceKind, string>;

export const viewLabels = {
  documents: "Documents",
  proposals: "Proposals",
  validations: "Documents Validations",
  lists: "Digitization Lists",
  projects: "Projects",
  categories: "Categories",
  intentions: "Intentions",
  tasks: "Tasks",
} as const satisfies Record<Watchlist["view"], string>;

interface ShareWatchlistDialogProps {
  isOpen: boolean;
  onClose: () => void;
  watchlist: Watchlist;
  onSave: (audience: WatchlistAudience) => Promise<ActionResult<unknown>>;
}

export function ShareWatchlistDialog({
  isOpen,
  onClose,
  watchlist,
  onSave,
}: ShareWatchlistDialogProps) {
  const id = useId();
  const { data: groups = [] } = useGroupsQuery();
  const { data: roles = [] } = useRolesQuery();
  const [audience, setAudience] = useState<WatchlistAudience>(watchlist.audience);
  const [isPending, setIsPending] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const picked: { groupIds: readonly string[]; roleIds: readonly string[] } =
    audience.kind === "some" ? audience : { groupIds: [], roleIds: [] };
  const isEmpty = audience.kind === "some" && picked.groupIds.length + picked.roleIds.length === 0;
  const { data: reach } = useQuery({
    queryKey: ["watchlists", "reach", watchlist.id, audience],
    queryFn: () =>
      getWatchlistReach({
        view: watchlist.view,
        filter: watchlist.filter,
        audience,
        watchlistId: watchlist.id,
      }),
    enabled: isOpen && audience.kind !== "personal" && !isEmpty,
  });

  const choose = (kind: AudienceKind) =>
    setAudience(
      kind === "some"
        ? { kind, groupIds: [...picked.groupIds], roleIds: [...picked.roleIds] }
        : { kind },
    );
  const toggle = (field: "groupIds" | "roleIds", recordId: string) => {
    const toggled = picked[field].includes(recordId)
      ? picked[field].filter((other) => other !== recordId)
      : [...picked[field], recordId];
    setAudience({
      kind: "some",
      groupIds: field === "groupIds" ? toggled : [...picked.groupIds],
      roleIds: field === "roleIds" ? toggled : [...picked.roleIds],
    });
  };

  const close = () => {
    setAudience(watchlist.audience);
    setRefusal(null);
    onClose();
  };

  const save = async () => {
    setIsPending(true);
    const result = await onSave(audience);
    setIsPending(false);
    if (result.isDone) {
      close();
      return;
    }

    setRefusal(result.refusal);
  };

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={close}
      title={`Share “${watchlist.name}”`}
      description={`Who sees the watchlist ${watchlist.name}`}
      isDirty={JSON.stringify(audience) !== JSON.stringify(watchlist.audience)}
      refusal={refusal}
      primary={{
        label: "Save",
        isPending,
        isDisabled: isEmpty,
        onSelect: () => void save(),
      }}
    >
      <div className="grid gap-4">
        <RadioGroup
          aria-label="Who sees it"
          value={audience.kind}
          onValueChange={(value) => {
            const kind = audienceKinds.find((candidate) => candidate === value);
            if (kind !== undefined) {
              choose(kind);
            }
          }}
          className="grid gap-2"
        >
          {audienceKinds.map((kind) => (
            <div key={kind} className="flex items-center gap-2">
              <RadioGroupItem id={`${id}-${kind}`} value={kind} />
              <Label htmlFor={`${id}-${kind}`} className="font-normal">
                {kind === "everyone"
                  ? `Everyone who opens ${viewLabels[watchlist.view]}`
                  : audienceLabels[kind]}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {audience.kind === "some" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="grid content-start gap-1.5">
              <legend className="mb-1 text-xs font-semibold text-muted-foreground">Groups</legend>
              {groups.map((group) => (
                <label
                  key={group.id}
                  htmlFor={`${id}-group-${group.id}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    id={`${id}-group-${group.id}`}
                    checked={picked.groupIds.includes(group.id)}
                    onCheckedChange={() => toggle("groupIds", group.id)}
                  />
                  {group.name}
                  <span className="text-xs text-muted-foreground">
                    {plural(group.peopleCount, "person", "people")}
                  </span>
                </label>
              ))}
            </fieldset>
            <fieldset className="grid content-start gap-1.5">
              <legend className="mb-1 text-xs font-semibold text-muted-foreground">Roles</legend>
              {roles.map((role) => (
                <label
                  key={role.id}
                  htmlFor={`${id}-role-${role.id}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    id={`${id}-role-${role.id}`}
                    checked={picked.roleIds.includes(role.id)}
                    onCheckedChange={() => toggle("roleIds", role.id)}
                  />
                  {role.name}
                </label>
              ))}
              <p className="text-xs text-muted-foreground">
                Holders by hand or mapped by an identity provider, alike.
              </p>
            </fieldset>
          </div>
        )}

        <ReachLine
          audience={audience}
          isEmpty={isEmpty}
          viewLabel={viewLabels[watchlist.view]}
          reach={reach}
        />
      </div>
    </DialogShell>
  );
}

function ReachLine({
  audience,
  isEmpty,
  viewLabel,
  reach,
}: {
  audience: WatchlistAudience;
  isEmpty: boolean;
  viewLabel: string;
  reach: { userCount: number; outOfViewCount: number; duplicateCount: number } | undefined;
}) {
  if (audience.kind === "personal") {
    return (
      <p className="text-xs text-muted-foreground">
        Only you see it: it becomes your own, and nobody else keeps it.
      </p>
    );
  }

  if (isEmpty) {
    return <p className="text-xs text-tone-amber-foreground">Pick a group or a role.</p>;
  }

  if (reach === undefined) {
    return <p className="text-xs text-muted-foreground">Working out who it reaches…</p>;
  }

  return (
    <div className="grid gap-1 text-sm">
      <p>
        Reaches <b className="font-semibold">{plural(reach.userCount, "person", "people")}</b>.
      </p>
      {reach.duplicateCount > 0 && (
        <p className="text-xs text-tone-amber-foreground">
          {reach.duplicateCount} of the {reach.userCount} already keep this filter as their own, and
          will see both until they delete theirs.
        </p>
      )}
      {reach.outOfViewCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {plural(reach.outOfViewCount, "more person is", "more people are")} in the audience but
          cannot open {viewLabel}, so they do not see it.
        </p>
      )}
    </div>
  );
}
