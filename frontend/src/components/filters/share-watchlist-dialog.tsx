// WATCH-audience: who sees a watchlist, shared by creation and audience editing: its
// owner alone, everyone who opens the view, or the members of some groups and the holders of some
// roles. Before it is saved it says, from the server, how many people the audience reaches, how
// many in it cannot open the view, and how many of the reached already keep the same filter as
// their own. Only `watchlist.manage_system` may save a system audience.

import { useQuery } from "@tanstack/react-query";
import type { Watchlist, WatchlistAudience } from "@vera/domain/entities";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { getWatchlistReach } from "@/api/watchlists";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ActionResult, Refusal } from "@/hooks/use-action-mutation";
import { useGroupsQuery, useRolesQuery } from "@/hooks/use-reference-query";

const audienceKinds = ["personal", "everyone", "some"] as const;
type AudienceKind = (typeof audienceKinds)[number];

const audienceLabels = {
  personal: "watchlist.onlyMe",
  everyone: "watchlist.everyone",
  some: "watchlist.someGroupsRoles",
} as const satisfies Record<AudienceKind, string>;

export const viewLabels = {
  documents: "common:navigation.entry.documents",
  "my-documents": "common:navigation.entry.my-documents",
  requests: "common:navigation.entry.requests",
  validations: "common:navigation.entry.validations",
  lists: "common:navigation.entry.lists",
  projects: "common:navigation.entry.projects",
  categories: "common:navigation.entry.categories",
  mixes: "common:navigation.entry.mixes",
  intentions: "common:navigation.entry.intentions",
  tasks: "common:navigation.entry.tasks",
} as const satisfies Record<Watchlist["view"], string>;

export function isEmptyWatchlistAudience(audience: WatchlistAudience): boolean {
  return audience.kind === "some" && audience.groupIds.length + audience.roleIds.length === 0;
}

export function WatchlistAudiencePicker({
  audience,
  onChange,
  view,
  allowPersonal = false,
}: {
  audience: WatchlistAudience;
  onChange: (audience: WatchlistAudience) => void;
  view: Watchlist["view"];
  allowPersonal?: boolean;
}) {
  // Labels may be message keys or server text; missing keys remain unchanged.
  const { t } = useTranslation("common");
  const id = useId();
  const { data: groups = [] } = useGroupsQuery();
  const { data: roles = [] } = useRolesQuery();
  const picked: { groupIds: readonly string[]; roleIds: readonly string[] } =
    audience.kind === "some" ? audience : { groupIds: [], roleIds: [] };

  const choose = (kind: AudienceKind) =>
    onChange(
      kind === "some"
        ? { kind, groupIds: [...picked.groupIds], roleIds: [...picked.roleIds] }
        : { kind },
    );
  const toggle = (field: "groupIds" | "roleIds", recordId: string) => {
    const toggled = picked[field].includes(recordId)
      ? picked[field].filter((other) => other !== recordId)
      : [...picked[field], recordId];
    onChange({
      kind: "some",
      groupIds: field === "groupIds" ? toggled : [...picked.groupIds],
      roleIds: field === "roleIds" ? toggled : [...picked.roleIds],
    });
  };

  return (
    <div className="grid gap-4">
      <RadioGroup
        aria-label={t("watchlist.whoSeesIt")}
        value={audience.kind}
        onValueChange={(value) => {
          const kind = audienceKinds.find((candidate) => candidate === value);
          if (kind !== undefined && (kind !== "personal" || allowPersonal)) choose(kind);
        }}
        className="grid gap-2"
      >
        {audienceKinds
          .filter((kind) => allowPersonal || kind !== "personal")
          .map((kind) => (
            <div key={kind} className="flex items-center gap-2">
              <RadioGroupItem id={`${id}-${kind}`} value={kind} />
              <Label htmlFor={`${id}-${kind}`} className="grid gap-0.5 font-normal">
                <span>
                  {kind === "everyone"
                    ? t("watchlist.everyoneOpens", { view: t(viewLabels[view]) })
                    : t(audienceLabels[kind])}
                </span>
                {kind !== "personal" && (
                  <span className="text-xs text-muted-foreground">{t("watchlist.system")}</span>
                )}
              </Label>
            </div>
          ))}
      </RadioGroup>

      {audience.kind === "some" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="grid content-start gap-1.5">
            <legend className="mb-1 text-xs font-semibold text-muted-foreground">
              {t("watchlist.groups")}
            </legend>
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
                  {t("watchlist.people", { count: group.peopleCount })}
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className="grid content-start gap-1.5">
            <legend className="mb-1 text-xs font-semibold text-muted-foreground">
              {t("watchlist.roles")}
            </legend>
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
            <p className="text-xs text-muted-foreground">{t("watchlist.roleHolders")}</p>
          </fieldset>
        </div>
      )}
    </div>
  );
}

interface ShareWatchlistDialogProps {
  isOpen: boolean;
  onClose: () => void;
  watchlist: Watchlist;
  mode?: "publish" | "audience";
  onSave: (audience: WatchlistAudience) => Promise<ActionResult<unknown>>;
}

export function ShareWatchlistDialog({
  isOpen,
  onClose,
  watchlist,
  mode = "audience",
  onSave,
}: ShareWatchlistDialogProps) {
  // The watchlist name is record data; the surrounding copy is translated here.
  const { t } = useTranslation("common");
  const [audience, setAudience] = useState<WatchlistAudience>(
    watchlist.audience.kind === "personal" ? { kind: "everyone" } : watchlist.audience,
  );
  const [isPending, setIsPending] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const isEmpty = isEmptyWatchlistAudience(audience);
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

  const close = () => {
    setAudience(watchlist.audience.kind === "personal" ? { kind: "everyone" } : watchlist.audience);
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
      title={t(mode === "publish" ? "watchlist.createFrom" : "watchlist.audienceFor", {
        name: watchlist.name,
      })}
      description={
        mode === "publish"
          ? t("watchlist.createDescription")
          : t("watchlist.audienceDescription", { name: watchlist.name })
      }
      isDirty={JSON.stringify(audience) !== JSON.stringify(watchlist.audience)}
      refusal={refusal}
      primary={{
        label: t(mode === "publish" ? "watchlist.create" : "watchlist.saveAudience"),
        isPending,
        isDisabled: isEmpty,
        onSelect: () => void save(),
      }}
    >
      <div className="grid gap-4">
        <WatchlistAudiencePicker audience={audience} onChange={setAudience} view={watchlist.view} />

        <ReachLine
          audience={audience}
          isEmpty={isEmpty}
          viewLabel={viewLabels[watchlist.view]}
          reach={reach}
        />
        <p className="text-xs text-muted-foreground">{t("watchlist.managersIncluded")}</p>
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
  const { t } = useTranslation("common");
  if (audience.kind === "personal") {
    return <p className="text-xs text-muted-foreground">{t("watchlist.personalDescription")}</p>;
  }

  if (isEmpty) {
    return <p className="text-xs text-tone-amber-foreground">{t("watchlist.pickAudience")}</p>;
  }

  if (reach === undefined) {
    return <p className="text-xs text-muted-foreground">{t("watchlist.calculatingReach")}</p>;
  }

  return (
    <div className="grid gap-1 text-sm">
      <p>{t("watchlist.reaches", { count: reach.userCount, outOfViewCount: "" })}</p>
      {reach.duplicateCount > 0 && (
        <p className="text-xs text-tone-amber-foreground">
          {t("watchlist.duplicates", {
            duplicateCount: reach.duplicateCount,
            count: reach.userCount,
          })}
        </p>
      )}
      {reach.outOfViewCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("watchlist.outOfView", { count: reach.outOfViewCount, view: t(viewLabel) })}
        </p>
      )}
    </div>
  );
}
