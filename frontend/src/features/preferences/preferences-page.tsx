import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useParams } from "react-router";
import { getAccount } from "@/api/session";
import { listWatchlists } from "@/api/watchlists";
import { TabLink, TabStrip } from "@/components/filters/tab-strip";
import { navigationEntries, visibleNavigation } from "@/components/layout/navigation";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { WatchlistView } from "@/domain/entities";
import { watchlistViewSchema } from "@/domain/entities";
import type { Grant, Permission } from "@/domain/permissions";
import { permissionCatalog, permissionGroups } from "@/domain/permissions";
import { useAppearance } from "@/hooks/use-appearance";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useSidebarPreference } from "@/hooks/use-sidebar-preference";
import { useUserSettingsMutation, useUserSettingsQuery } from "@/hooks/use-user-settings-query";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";

const sections = ["display", "account"] as const;
type Section = (typeof sections)[number];

function viewLabel(view: WatchlistView): string {
  return navigationEntries.find((entry) => entry.id === view)?.label ?? view;
}

export function PreferencesPage() {
  const { section } = useParams();
  if (section === undefined) return <Navigate to="/preferences/display" replace />;
  if (!sections.includes(section as Section)) return <Navigate to="/preferences/display" replace />;

  return (
    <>
      <PageHeader title="Preferences" />
      <TabStrip label="Preference sections">
        {sections.map((name) => (
          <TabLink
            key={name}
            to={`/preferences/${name}`}
            selected={name === section}
            className="capitalize"
          >
            {name}
          </TabLink>
        ))}
      </TabStrip>
      <PageContent className="bg-muted/20">
        <div className="mx-auto max-w-4xl">
          {section === "display" && <DisplayPreferences />}
          {section === "account" && <AccountPreferences />}
        </div>
      </PageContent>
    </>
  );
}

function DisplayPreferences() {
  const { data: settings, isPending } = useUserSettingsQuery();
  const update = useUserSettingsMutation();
  const { appearance } = useAppearance();
  const sidebar = useSidebarPreference();
  const { data: watchlists = [] } = useQuery({
    queryKey: watchlistsQueryKey,
    queryFn: () => listWatchlists(),
  });
  const { data: session } = useSessionQuery();
  const visibleViews = watchlistViewSchema.options.filter((view) =>
    navigationEntries.some(
      (entry) =>
        entry.id === view &&
        session?.grants.some((grant) => entry.requires.includes(grant.permission)),
    ),
  );
  const [error, setError] = useState("");
  const save = async (change: Parameters<typeof update.mutateAsync>[0]) => {
    setError("");
    try {
      await update.mutateAsync(change);
    } catch {
      setError("Could not save display preferences.");
    }
  };
  if (isPending)
    return <p className="text-sm text-muted-foreground">Loading display preferences…</p>;
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Display</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These choices follow your account. Sidebar width stays on this device for each screen
          size.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Choice
          label="Appearance"
          value={appearance}
          options={["system", "light", "dark"]}
          onChange={(value) => save({ appearance: value as typeof appearance })}
        />
        <Choice
          label="List density"
          value={settings?.density ?? "comfortable"}
          options={["comfortable", "compact"]}
          onChange={(value) => save({ density: value as "comfortable" | "compact" })}
        />
        <Choice
          label="Date format"
          value={settings?.dateFormat ?? "local"}
          options={["local", "iso"]}
          onChange={(value) => save({ dateFormat: value as "local" | "iso" })}
        />
      </div>
      <div>
        <h3 className="font-semibold">Sidebar on this device</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Remembered separately for notebook and large screens.
        </p>
        <div className="mt-3 flex flex-wrap gap-6 text-sm">
          <span className="flex items-center gap-2">
            Notebook expanded{" "}
            <Switch
              aria-label="Notebook sidebar expanded"
              checked={sidebar.preferences.notebook ?? false}
              onCheckedChange={(checked) => sidebar.setForTier("notebook", checked)}
            />
          </span>
          <span className="flex items-center gap-2">
            Large screen expanded{" "}
            <Switch
              aria-label="Large screen sidebar expanded"
              checked={sidebar.preferences.large ?? true}
              onCheckedChange={(checked) => sidebar.setForTier("large", checked)}
            />
          </span>
        </div>
      </div>
      <div>
        <h3 className="font-semibold">Opening tabs</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the tab a view opens on, or follow the last tab you used.
        </p>
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
                  ...watchlists
                    .filter((item) => item.view === view && !item.viewer.isHidden)
                    .map((item) => item.id),
                ]}
                labels={{
                  last: "Last used",
                  all: "All",
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
  const { data: session } = useSessionQuery();
  const {
    data: account,
    isPending,
    isError,
  } = useQuery({ queryKey: ["session-account"], queryFn: getAccount });
  return (
    <section>
      <h2 className="text-lg font-semibold">Account</h2>
      {isPending && <p className="mt-4 text-sm text-muted-foreground">Loading account…</p>}
      {isError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          Could not load account details.
        </p>
      )}
      {account && (
        <div className="mt-5 space-y-5 rounded-lg border bg-background p-5 text-sm">
          <div>
            <span className="text-muted-foreground">Name</span>
            <p className="font-medium">{account.name}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Email</span>
            <p>{account.email ?? "No email address"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Sign-in identities</span>
            {account.identities.length === 0 ? (
              <p>None recorded</p>
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
                        ? `Last used ${new Date(identity.lastLoginAt).toLocaleString()}`
                        : "Never used"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {session && (
            <>
              <div className="border-t pt-5">
                <h3 className="font-semibold">Your roles</h3>
                <p className="mt-1 text-muted-foreground">
                  Roles combine to give the access listed below.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {session.roleIds.length === 0
                    ? "No roles assigned"
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
                <h3 className="font-semibold">Views you can open</h3>
                <p className="mt-2">
                  {visibleNavigation(session)
                    .map((entry) => entry.visibleLabel)
                    .join(" · ") || "No views available"}
                </p>
              </div>
              <div className="border-t pt-5">
                <h3 className="font-semibold">What you can do</h3>
                <p className="mt-1 text-muted-foreground">
                  Effective permissions from all your roles. Some actions only apply within your
                  custody or projects.
                </p>
                {session.grants.length === 0 ? (
                  <p className="mt-3">No permissions assigned.</p>
                ) : (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {permissionGroups.map((group) => {
                      const grants = session.grants.filter(
                        (grant) => permissionCatalog[grant.permission].group === group,
                      );
                      return grants.length === 0 ? null : (
                        <div key={group} className="rounded-md border p-3">
                          <h4 className="font-semibold">{group}</h4>
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

const subjects: Record<string, string> = {
  request: "proposals",
  iteration: "documents",
  validation: "validations",
  restriction: "restrictions",
  addition: "additions",
  list: "digitization lists",
  intention: "intentions",
  mix: "mixes",
  project: "projects",
  category: "categories",
  task: "tasks",
  plugin: "plugins",
  hook: "hooks",
  access: "users and groups",
  watchlist: "shared watchlists",
};

function permissionLabel(permission: Permission): string {
  const special: Partial<Record<Permission, string>> = {
    watch: "Watch changes",
    "request.withdraw_own": "Withdraw own proposals",
    "request.read_own": "View own proposals",
    "task.read_own": "View own tasks",
    "intention.edit_overall": "Edit Overall intention",
    "intention.repeat": "Manage repeats",
    "project.manage_members": "Manage project members",
    "category.grant_custody": "Grant category custody",
    "addition.read_payload": "View addition payloads",
    "plugin.upload_code": "Upload plugin code",
    "watchlist.manage_shared": "Manage shared watchlists",
  };
  if (special[permission]) return special[permission];
  const [subject, action = ""] = permission.split(".");
  const verbs: Record<string, string> = {
    read: "View",
    create: "Create",
    edit: "Edit",
    delete: "Delete",
    decide: "Decide",
    recheck: "Re-check",
    classify: "Classify",
    approve: "Approve",
    deny: "Deny",
    revoke: "Revoke",
    overrule: "Overrule",
    cancel: "Cancel",
    resume: "Resume",
    publish: "Publish",
    retry: "Retry",
    manage: "Manage",
    schedule: "Schedule",
    configure: "Configure",
    run: "Run",
  };
  return `${verbs[action] ?? action.replaceAll("_", " ")} ${subjects[subject] ?? subject}`;
}

function scopeLabel(scope: Grant["scope"]): string {
  switch (scope) {
    case null:
      return "own";
    case "any":
      return "all";
    case "custody":
      return "in custody";
    case "project":
      return "in projects";
    case "managed":
      return "managed projects";
  }
}
