// The navigation bar: the logo, the toggle, the entries the session holds and the user at the
// foot. Docked, it switches between the expanded list and the two-letter rail with a toggle row
// under the logo (navigation.md §4.1, §4.3). Inside the narrow tiers' sheet it is always expanded
// and has no toggle. The rail's hover-expand (§4.2) is the shell's: it passes `isPeeking` while
// the rail is open over the content, and the toggle still answers for the remembered choice.
// After a rule at the foot comes what is running, while anything is (§6).
// User options live in a dropdown at the foot; labels move to i18n.

import { useQuery } from "@tanstack/react-query";
import type { Session } from "@vera/domain/entities";
import { hasAnyPermission } from "@vera/domain/permissions";
import {
  Bell,
  Bookmark,
  ChevronsRight,
  LogOut,
  Monitor,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { logout } from "@/api/session";
import { listWatchlists } from "@/api/watchlists";
import { visibleNavigation } from "@/components/layout/navigation";
import { RunningTasksPanel } from "@/components/layout/running-tasks-panel";
import { Logo } from "@/components/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Appearance } from "@/hooks/use-appearance";
import { useAppearance } from "@/hooks/use-appearance";
import { sidebarImmediateAttribute } from "@/hooks/use-sidebar-peek";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";
import { cn } from "@/lib/utils";

interface SidebarProps {
  session: Session | undefined;
  isExpanded: boolean;
  // The collapsed rail is open over the content for a moment.
  isPeeking?: boolean;
  // Absent in the sheet, which is always expanded.
  onToggle?: () => void;
  onNavigate?: () => void;
  onMenuNavigate?: () => void;
  onUserMenuOpenChange?: (open: boolean) => void;
  className?: string;
}

export function Sidebar({
  session,
  isExpanded,
  isPeeking = false,
  onToggle,
  onNavigate,
  onMenuNavigate,
  onUserMenuOpenChange,
  className,
}: SidebarProps) {
  const navigate = useNavigate();
  const [menuError, setMenuError] = useState("");
  const { appearance, setAppearance } = useAppearance();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const entries = session === undefined ? [] : visibleNavigation(session);
  const { data: watchlists = [] } = useQuery({
    queryKey: [...watchlistsQueryKey, "visible"],
    queryFn: () => listWatchlists(),
    enabled:
      session !== undefined && hasAnyPermission(session, ["watch", "watchlist.manage_system"]),
    refetchInterval: 60_000,
  });
  const changedByView = new Map<string, number>();
  for (const watchlist of watchlists) {
    if (watchlist.newCount > 0) {
      const navView = watchlist.view === "my-documents" ? "documents" : watchlist.view;
      changedByView.set(navView, (changedByView.get(navView) ?? 0) + 1);
    }
  }
  const isShowingLabels = isExpanded || isPeeking;
  const labelClassName = cn("truncate", !isShowingLabels && "sr-only");

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden bg-sidebar py-3 text-sidebar-foreground transition-[width] duration-200",
        isShowingLabels ? "w-66" : "w-14",
        isPeeking && "shadow-peek",
        className,
      )}
    >
      <NavLink
        to="/"
        onClick={onNavigate}
        title="VERA"
        className="flex shrink-0 items-center gap-2.5 px-3.5 pb-3 font-semibold text-sidebar-accent-foreground"
      >
        <Logo
          className="size-7 shrink-0 text-sidebar-primary"
          markClassName="fill-sidebar-primary-foreground"
        />
        <span className={labelClassName}>VERA</span>
      </NavLink>

      {onToggle && (
        <button
          type="button"
          {...sidebarImmediateAttribute}
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse navigation" : "Expand navigation"}
          title={isExpanded ? "Collapse navigation" : "Expand navigation"}
          className="mx-2 mb-3 flex h-8 shrink-0 items-center justify-center rounded-md text-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <ChevronsRight
            className={cn("size-4 transition-transform duration-200", isExpanded && "rotate-180")}
          />
        </button>
      )}

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2">
        {entries.map((entry) => {
          const badgeCount = changedByView.get(entry.id) ?? 0;
          return (
            <NavLink
              key={entry.id}
              to={entry.path}
              onClick={onNavigate}
              title={entry.visibleLabel}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm whitespace-nowrap",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )
              }
            >
              <span className="relative grid size-7 shrink-0 place-items-center text-caption font-bold">
                {entry.rail}
                {badgeCount > 0 && !isShowingLabels && (
                  <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-sidebar-primary" />
                )}
              </span>
              <span className={labelClassName}>{entry.visibleLabel}</span>
              {badgeCount > 0 && isShowingLabels && (
                <span
                  className="ml-auto rounded-full bg-sidebar-primary/15 px-2 py-0.5 text-xs font-semibold tabular-nums"
                  title={`${badgeCount} watchlists with new items in ${entry.visibleLabel}`}
                >
                  {badgeCount}
                  <span className="sr-only"> watchlists with new items</span>
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="mx-2 mt-2 shrink-0 border-t border-sidebar-border pt-3">
        <RunningTasksPanel
          session={session}
          isShowingLabels={isShowingLabels}
          onNavigate={onNavigate}
        />
        <DropdownMenu onOpenChange={onUserMenuOpenChange}>
          <DropdownMenuTrigger asChild disabled={session === undefined || isLoggingOut}>
            <button
              type="button"
              aria-label="User menu"
              title={session?.user.name}
              className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1 text-left hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-sidebar-ring"
            >
              <span className="grid size-7 shrink-0 place-items-center">
                <UserRound className="size-4" />
              </span>
              <span
                className={cn(
                  "min-w-0 truncate text-sm font-medium text-sidebar-accent-foreground",
                  !isShowingLabels && "sr-only",
                )}
              >
                {session?.user.name ?? "Loading user…"}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-64">
            <DropdownMenuLabel className="space-y-1.5 px-2 py-2 font-normal">
              <strong className="block truncate text-sm font-semibold">{session?.user.name}</strong>
              {session?.user.email && (
                <span className="block truncate text-xs text-muted-foreground">
                  {session.user.email}
                </span>
              )}
              <span className="block text-xs text-muted-foreground">
                Roles: {session?.roleIds.join(", ") || "none"}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Preferences</DropdownMenuLabel>
            {[
              { path: "/preferences/watchlists", label: "Watchlists", Icon: Bookmark },
              { path: "/preferences/notifications", label: "Notifications", Icon: Bell },
              { path: "/preferences/display", label: "Display", Icon: SlidersHorizontal },
              { path: "/preferences/account", label: "Account", Icon: ShieldCheck },
            ].map(({ path, label, Icon }) => (
              <DropdownMenuItem
                key={path}
                onSelect={() => {
                  navigate(path);
                  onMenuNavigate?.();
                }}
              >
                <Icon /> {label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            {/* The same choice as Preferences → Display (UI-user-menu); the menu stays open. */}
            <DropdownMenuRadioGroup
              value={appearance}
              onValueChange={(value) => {
                setMenuError("");
                setAppearance(value as Appearance).catch(() =>
                  setMenuError("Could not change the appearance. Try again."),
                );
              }}
            >
              {appearanceChoices.map(({ value, label, Icon }) => (
                <DropdownMenuRadioItem
                  key={value}
                  value={value}
                  onSelect={(event) => event.preventDefault()}
                >
                  <Icon /> {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            {menuError && (
              <p role="alert" className="px-2 py-1 text-xs text-destructive">
                {menuError}
              </p>
            )}
            <DropdownMenuItem
              variant="destructive"
              onSelect={async () => {
                setIsLoggingOut(true);
                try {
                  await logout();
                  window.location.assign("/signed-out");
                } catch {
                  setMenuError("Could not sign out. Try again.");
                  setIsLoggingOut(false);
                }
              }}
            >
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

const appearanceChoices = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
] as const satisfies readonly { value: Appearance; label: string; Icon: typeof Sun }[];
