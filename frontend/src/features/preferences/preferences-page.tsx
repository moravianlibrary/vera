// Shape: Settings.

import { useQuery } from "@tanstack/react-query";
import { languages } from "@vera/contract/user-settings";
import { pushChannelId } from "@vera/contract/watchlists";
import type { WatchlistView } from "@vera/domain/entities";
import { watchlistViewSchema } from "@vera/domain/entities";
import type { Grant, Permission } from "@vera/domain/permissions";
import {
  canOpenMyDocuments,
  catalogEntryOf,
  hasPermission,
  permissionGroups,
  propertyOfPermission,
} from "@vera/domain/permissions";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams, useSearchParams } from "react-router";
import { getNotificationHooks } from "@/api/hooks";
import { getAccount } from "@/api/session";
import { listWatchlists } from "@/api/watchlists";
import { TabLink, TabStrip } from "@/components/filters/tab-strip";
import { navigationEntries, visibleNavigation } from "@/components/layout/navigation";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import { failureOf, QueryError } from "@/components/query-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  pushChannelName,
  unreachableTextOf,
  useWatchlistChannelsQuery,
} from "@/features/preferences/watchlist-channels";
import { WatchlistPreferences } from "@/features/preferences/watchlists-page";
import { useAppearance } from "@/hooks/use-appearance";
import { useLanguage } from "@/hooks/use-language";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useSidebarPreference } from "@/hooks/use-sidebar-preference";
import { useUserSettingsMutation, useUserSettingsQuery } from "@/hooks/use-user-settings-query";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";
import { i18n } from "@/i18n";
import { languageNames } from "@/i18n/language";
import { formatLongDayAndTime } from "@/lib/format-date";

const sections = ["watchlists", "notifications", "display", "account"] as const;
type Section = (typeof sections)[number];

function viewLabel(view: WatchlistView): string {
  const key = navigationEntries.find((entry) => entry.id === view)?.label;
  return key === undefined ? view : i18n.t(key);
}

export function PreferencesPage() {
  const { t } = useTranslation("preferences");
  const { section } = useParams();
  if (section === undefined) return <Navigate to="/preferences/watchlists" replace />;
  if (!sections.includes(section as Section))
    return <Navigate to="/preferences/watchlists" replace />;

  return (
    <>
      <PageHeader title={t("page.title")} />
      <TabStrip label={t("page.sectionsLabel")}>
        {sections.map((name) => (
          <TabLink
            key={name}
            to={`/preferences/${name}`}
            selected={name === section}
            className="capitalize"
          >
            {t(`section.${name}`)}
          </TabLink>
        ))}
      </TabStrip>
      <PageContent className="bg-muted/20">
        <div className={section === "watchlists" ? "mx-auto max-w-6xl" : "mx-auto max-w-4xl"}>
          {section === "watchlists" && <WatchlistPreferences />}
          {section === "notifications" && <NotificationsPreferences />}
          {section === "display" && <DisplayPreferences />}
          {section === "account" && <AccountPreferences />}
        </div>
      </PageContent>
    </>
  );
}

function NotificationsPreferences() {
  const { t } = useTranslation("preferences");
  const [params] = useSearchParams();
  const focusedHook = params.get("hook");
  const { data: settings } = useUserSettingsQuery();
  const hooksQuery = useQuery({
    queryKey: ["notification-hooks"],
    queryFn: getNotificationHooks,
  });
  const { data: hooks = [], isPending, isError } = hooksQuery;
  const update = useUserSettingsMutation();
  const choices = settings?.notifications ?? { doNotSend: false, hooks: {} };
  const [error, setError] = useState("");
  const save = async (next: typeof choices) => {
    setError("");
    try {
      await update.mutateAsync({ notifications: next });
    } catch {
      setError(t("notifications.saveError"));
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{t("notifications.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("notifications.description")}</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-4 rounded-lg border bg-background p-4">
        <div>
          <p className="font-medium">{t("notifications.doNotSend")}</p>
          <p className="text-xs text-muted-foreground">{t("notifications.doNotSendDescription")}</p>
        </div>
        <Switch
          aria-label={t("notifications.doNotSend")}
          checked={choices.doNotSend}
          disabled={update.isPending}
          onCheckedChange={(doNotSend) => void save({ ...choices, doNotSend })}
        />
      </div>
      <OffEverywhere
        channelsOff={choices.channelsOff ?? []}
        noHookEmail={choices.noHookEmail === true}
        isSaving={update.isPending}
        onChange={(change) => void save({ ...choices, ...change })}
      />
      <h3 className="font-semibold">{t("notifications.hookEmails")}</h3>
      {isPending && (
        <p className="text-sm text-muted-foreground">{t("notifications.loadingHooks")}</p>
      )}
      {isError && failureOf(hooksQuery, t("notifications.loadHooksError")) && (
        <QueryError
          failure={
            failureOf(hooksQuery, t("notifications.loadHooksError")) ?? {
              text: t("notifications.loadHooksError"),
              onRetry: () => void hooksQuery.refetch(),
            }
          }
        />
      )}
      {!isPending && !isError && hooks.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("notifications.noHooks")}</p>
      )}
      <div className="divide-y rounded-lg border bg-background">
        {hooks.map((hook) => (
          <div
            key={hook.id}
            id={`hook-preference-${hook.id}`}
            className={`flex items-center justify-between gap-4 px-4 py-3 ${focusedHook === hook.id ? "bg-accent/40" : ""}`}
          >
            <div>
              <p className="font-medium">{hook.label}</p>
              <p className="text-xs text-muted-foreground">
                {hook.events.join(" · ")}
                {!hook.isActive && ` · ${t("notifications.hookPaused")}`} ·{" "}
                {t(hook.defaultEnabled ? "emailLink.onByDefault" : "emailLink.offByDefault")}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-2">
              {choices.noHookEmail === true && (choices.hooks[hook.id] ?? hook.defaultEnabled) && (
                <span className="text-xs text-tone-amber-foreground">
                  {t("notifications.hookEmailOffForAll")}
                </span>
              )}
              <Switch
                aria-label={t("emailLink.hookEmail", { name: hook.label })}
                checked={choices.hooks[hook.id] ?? hook.defaultEnabled}
                disabled={update.isPending}
                onCheckedChange={(enabled) =>
                  void save({ ...choices, hooks: { ...choices.hooks, [hook.id]: enabled } })
                }
              />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// WATCH-channel-off: beside *Do not send notifications*, one kind off for every watchlist or hook,
// those that come later included; the individual choices stay for when it is cleared.
function OffEverywhere({
  channelsOff,
  noHookEmail,
  isSaving,
  onChange,
}: {
  channelsOff: readonly string[];
  noHookEmail: boolean;
  isSaving: boolean;
  onChange: (change: { channelsOff?: string[]; noHookEmail?: boolean }) => void;
}) {
  const { t } = useTranslation("preferences");
  const { data: channels = [] } = useWatchlistChannelsQuery();
  const toggle = (channelId: string, isOff: boolean) =>
    onChange({
      channelsOff: isOff
        ? [...channelsOff.filter((id) => id !== channelId), channelId]
        : channelsOff.filter((id) => id !== channelId),
    });
  const rows = [
    {
      id: pushChannelId,
      name: i18n.t(pushChannelName),
      note: t("channels.everyWatchlistPush"),
    },
    ...channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      note: unreachableTextOf(channel) ?? t("channels.everyWatchlist", { name: channel.name }),
    })),
  ];

  return (
    <div className="rounded-lg border bg-background">
      <h3 className="border-b px-4 py-2.5 font-semibold">{t("offEverywhere.title")}</h3>
      <div className="divide-y">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <p className="font-medium">{t("offEverywhere.noNamed", { name: row.name })}</p>
              <p className="text-xs text-muted-foreground">{row.note}</p>
            </div>
            <Switch
              aria-label={t("offEverywhere.noNamedForAnyWatchlist", { name: row.name })}
              checked={channelsOff.includes(row.id)}
              disabled={isSaving}
              onCheckedChange={(isOff) => toggle(row.id, isOff)}
            />
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="font-medium">{t("offEverywhere.noHookEmail")}</p>
            <p className="text-xs text-muted-foreground">
              {t("offEverywhere.noHookEmailDescription")}
            </p>
          </div>
          <Switch
            aria-label={t("offEverywhere.noHookEmail")}
            checked={noHookEmail}
            disabled={isSaving}
            onCheckedChange={(isOff) => onChange({ noHookEmail: isOff })}
          />
        </div>
      </div>
      <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        {t("offEverywhere.choicesStay")}
      </p>
    </div>
  );
}

function DisplayPreferences() {
  const { t } = useTranslation("preferences");
  const { data: settings, isPending } = useUserSettingsQuery();
  const update = useUserSettingsMutation();
  const { appearance } = useAppearance();
  const { language } = useLanguage();
  const sidebar = useSidebarPreference();
  const { data: watchlists = [] } = useQuery({
    queryKey: watchlistsQueryKey,
    queryFn: () => listWatchlists(),
  });
  const { data: session } = useSessionQuery();
  const visibleViews = watchlistViewSchema.options.filter((view) => {
    if (session === undefined) return false;
    if (view === "documents") return hasPermission(session, "iteration.read");
    if (view === "my-documents") return canOpenMyDocuments(session);
    return navigationEntries.some(
      (entry) =>
        entry.id === view &&
        session.grants.some((grant) => entry.requires.includes(grant.permission)),
    );
  });
  const [error, setError] = useState("");
  const save = async (change: Parameters<typeof update.mutateAsync>[0]) => {
    setError("");
    try {
      await update.mutateAsync(change);
    } catch {
      setError(t("display.saveError"));
    }
  };
  if (isPending) return <p className="text-sm text-muted-foreground">{t("display.loading")}</p>;
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t("display.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("display.description")}</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Choice
          label={t("display.appearance")}
          value={appearance}
          options={["system", "light", "dark"]}
          labels={{
            system: t("display.system"),
            light: t("display.light"),
            dark: t("display.dark"),
          }}
          onChange={(value) => save({ appearance: value as typeof appearance })}
        />
        <Choice
          label={t("display.language")}
          value={language}
          options={[...languages]}
          labels={languageNames}
          onChange={(value) => save({ language: value as typeof language })}
        />
        <Choice
          label={t("display.listDensity")}
          value={settings?.density ?? "comfortable"}
          options={["comfortable", "compact"]}
          labels={{ comfortable: t("display.comfortable"), compact: t("display.compact") }}
          onChange={(value) => save({ density: value as "comfortable" | "compact" })}
        />
        <Choice
          label={t("display.dateFormat")}
          value={settings?.dateFormat ?? "local"}
          options={["local", "iso"]}
          labels={{ local: t("display.localDate"), iso: t("display.isoDate") }}
          onChange={(value) => save({ dateFormat: value as "local" | "iso" })}
        />
      </div>
      <div>
        <h3 className="font-semibold">{t("display.sidebarTitle")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("display.sidebarDescription")}</p>
        <div className="mt-3 flex flex-wrap gap-6 text-sm">
          <span className="flex items-center gap-2">
            {t("display.notebookExpanded")}{" "}
            <Switch
              aria-label={t("display.notebookExpanded")}
              checked={sidebar.preferences.notebook ?? false}
              onCheckedChange={(checked) => sidebar.setForTier("notebook", checked)}
            />
          </span>
          <span className="flex items-center gap-2">
            {t("display.largeExpanded")}{" "}
            <Switch
              aria-label={t("display.largeExpanded")}
              checked={sidebar.preferences.large ?? true}
              onCheckedChange={(checked) => sidebar.setForTier("large", checked)}
            />
          </span>
        </div>
      </div>
      <div>
        <h3 className="font-semibold">{t("display.openingTabs")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("display.openingTabsDescription")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {visibleViews.map((view) => {
            const fixed = settings?.fixedOpeningWatchlists;
            const value =
              fixed && view in fixed
                ? fixed[view] === "__last__"
                  ? "last"
                  : (fixed[view] ?? "all")
                : "last";
            return (
              <Choice
                key={view}
                label={viewLabel(view)}
                value={value}
                options={[
                  "last",
                  "all",
                  ...watchlists.filter((item) => item.view === view).map((item) => item.id),
                ]}
                labels={{
                  last: t("display.lastUsed"),
                  all: t("display.all"),
                  ...Object.fromEntries(watchlists.map((item) => [item.id, item.name])),
                }}
                onChange={(selected) =>
                  save({
                    fixedOpeningWatchlists: {
                      [view]:
                        selected === "last" ? "__last__" : selected === "all" ? null : selected,
                    },
                  })
                }
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Choice({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 text-sm font-medium">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {labels?.[option] ?? option[0]?.toUpperCase() + option.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AccountPreferences() {
  const { t } = useTranslation("preferences");
  const { data: session } = useSessionQuery();
  const accountQuery = useQuery({ queryKey: ["session-account"], queryFn: getAccount });
  const { data: account, isPending, isError } = accountQuery;
  return (
    <section>
      <h2 className="text-lg font-semibold">{t("account.title")}</h2>
      {isPending && <p className="mt-4 text-sm text-muted-foreground">{t("account.loading")}</p>}
      {isError && (
        <QueryError
          failure={
            failureOf(accountQuery, t("account.loadError")) ?? {
              text: t("account.loadError"),
              onRetry: () => void accountQuery.refetch(),
            }
          }
          className="mt-4"
        />
      )}
      {account && (
        <div className="mt-5 space-y-5 rounded-lg border bg-background p-5 text-sm">
          <div>
            <span className="text-muted-foreground">{t("account.name")}</span>
            <p className="font-medium">{account.name}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t("account.email")}</span>
            <p>{account.email ?? t("account.noEmail")}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t("account.identities")}</span>
            {account.identities.length === 0 ? (
              <p>{t("account.noIdentities")}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {account.identities.map((identity) => (
                  <li
                    key={`${identity.instanceId}:${identity.externalId}`}
                    className="rounded-md border px-3 py-2"
                  >
                    <span className="font-medium">{identity.instanceId}</span> ·{" "}
                    {identity.externalId}
                    <p className="text-xs text-muted-foreground">
                      {identity.lastLoginAt
                        ? t("account.lastUsed", {
                            date: formatLongDayAndTime(identity.lastLoginAt),
                          })
                        : t("account.neverUsed")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {session && (
            <>
              <div className="border-t pt-5">
                <h3 className="font-semibold">{t("account.roles")}</h3>
                <p className="mt-1 text-muted-foreground">{t("account.rolesDescription")}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {session.roleIds.length === 0
                    ? t("account.noRoles")
                    : session.roleIds.map((role) => (
                        <span
                          key={role}
                          className="rounded-md bg-muted px-2 py-1 text-xs font-medium"
                        >
                          {role}
                        </span>
                      ))}
                </div>
              </div>
              <div className="border-t pt-5">
                <h3 className="font-semibold">{t("account.views")}</h3>
                <p className="mt-2">
                  {visibleNavigation(session)
                    .map((entry) => i18n.t(entry.visibleLabel))
                    .join(" · ") || t("account.noViews")}
                </p>
              </div>
              <div className="border-t pt-5">
                <h3 className="font-semibold">{t("account.permissions")}</h3>
                <p className="mt-1 text-muted-foreground">{t("account.permissionsDescription")}</p>
                {session.grants.length === 0 ? (
                  <p className="mt-3">{t("account.noPermissions")}</p>
                ) : (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {permissionGroups.map((group) => {
                      const grants = session.grants.filter(
                        (grant) => catalogEntryOf(grant.permission).group === group,
                      );
                      return grants.length === 0 ? null : (
                        <div key={group} className="rounded-md border p-3">
                          <h4 className="font-semibold">{t(`permissionGroup.${group}`)}</h4>
                          <ul className="mt-2 space-y-1.5">
                            {grants.map((grant) => (
                              <li
                                key={`${grant.permission}:${grant.scope}`}
                                className="flex items-baseline justify-between gap-3"
                              >
                                <span>{permissionLabel(grant.permission)}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {scopeLabel(grant.scope)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function permissionLabel(permission: Permission): string {
  const special: Partial<Record<Permission, string>> = {
    watch: "watch",
    "request.withdraw_own": "withdrawOwn",
    "request.read_mine": "readMine",
    "task.read_own": "readOwnTasks",
    "intention.repeat": "repeat",
    "project.manage_members": "manageMembers",
    "category.grant_custody": "grantCustody",
    "request.read_ingest": "readIngest",
    "request.retry": "retryIngest",
    "request.read_payload": "readPayload",
    "plugin.upload_code": "uploadPluginCode",
    "watchlist.manage_system": "manageSystemWatchlists",
    "property.define": "defineProperties",
  };
  if (special[permission])
    return i18n.t(`preferences:permissionLabel.special.${special[permission]}`);
  const propertyKey = propertyOfPermission(permission);
  if (propertyKey !== null)
    return i18n.t("preferences:permissionLabel.enterProperty", { property: propertyKey });
  const [subject, action = ""] = permission.split(".");
  const subjects: Record<string, string> = {
    request: "proposals",
    iteration: "documents",
    validation: "validations",
    restriction: "restrictions",
    addition: "additions",
    list: "digitizationLists",
    intention: "intentions",
    mix: "mixes",
    project: "projects",
    category: "categories",
    task: "tasks",
    plugin: "plugins",
    hook: "hooks",
    access: "usersAndGroups",
    watchlist: "sharedWatchlists",
  };
  const verbs = [
    "read",
    "create",
    "edit",
    "delete",
    "decide",
    "recheck",
    "classify",
    "approve",
    "deny",
    "revoke",
    "overrule",
    "cancel",
    "resume",
    "publish",
    "retry",
    "manage",
    "schedule",
    "configure",
    "run",
  ];
  const verb = verbs.includes(action)
    ? i18n.t(`preferences:permissionLabel.verb.${action}`)
    : action.replaceAll("_", " ");
  const translatedSubject = subjects[subject]
    ? i18n.t(`preferences:permissionLabel.subject.${subjects[subject]}`)
    : subject;
  return i18n.t("preferences:permissionLabel.generic", { verb, subject: translatedSubject });
}

function scopeLabel(scope: Grant["scope"]): string {
  switch (scope) {
    case null:
      return i18n.t("preferences:scope.own");
    case "any":
      return i18n.t("preferences:scope.all");
    case "custody":
      return i18n.t("preferences:scope.custody");
    case "project":
      return i18n.t("preferences:scope.projects");
    case "managed":
      return i18n.t("preferences:scope.managed");
  }
}
