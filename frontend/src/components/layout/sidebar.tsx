// The navigation bar: the logo, the toggle, the entries the session holds and the user at the
// foot. Docked, it switches between the expanded list and the two-letter rail with a toggle row
// under the logo (navigation.md §4.1, §4.3). Inside the narrow tiers' sheet it is always expanded
// and has no toggle. The rail's hover-expand (§4.2) is the shell's: it passes `isPeeking` while
// the rail is open over the content, and the toggle still answers for the remembered choice.
// After a rule at the foot comes what is running, while anything is (§6).
// TODO(rrandiak): the Watchlists row (§5) and the user menu (§7).

import { ChevronsRight, UserRound } from "lucide-react";
import { NavLink, useLocation } from "react-router";
import { visibleNavigation } from "@/components/layout/navigation";
import { RunningTasksPanel } from "@/components/layout/running-tasks-panel";
import { Logo } from "@/components/logo";
import type { Session } from "@/domain/entities";
import { sidebarImmediateAttribute } from "@/hooks/use-sidebar-peek";
import { cn } from "@/lib/utils";

interface SidebarProps {
  session: Session | undefined;
  isExpanded: boolean;
  // The collapsed rail is open over the content for a moment.
  isPeeking?: boolean;
  // Absent in the sheet, which is always expanded.
  onToggle?: () => void;
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({
  session,
  isExpanded,
  isPeeking = false,
  onToggle,
  onNavigate,
  className,
}: SidebarProps) {
  const location = useLocation();
  const entries = session === undefined ? [] : visibleNavigation(session);
  const isShowingLabels = isExpanded || isPeeking;
  const labelClassName = cn("truncate", !isShowingLabels && "sr-only");

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden bg-sidebar py-3 text-sidebar-foreground transition-[width] duration-200",
        isShowingLabels ? "w-66" : "w-14",
        isPeeking && "shadow-[8px_0_24px_rgb(15_23_42/0.28)]",
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
        {entries.map((entry) => (
          <NavLink
            key={entry.id}
            to={entry.path}
            onClick={onNavigate}
            title={entry.visibleLabel}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm whitespace-nowrap",
                isActive || (entry.id === "categories" && location.pathname.startsWith("/mixes"))
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )
            }
          >
            <span className="grid size-7 shrink-0 place-items-center text-[0.6875rem] font-bold">
              {entry.rail}
            </span>
            <span className={labelClassName}>{entry.visibleLabel}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mx-2 mt-2 shrink-0 border-t border-sidebar-border pt-3">
        <RunningTasksPanel
          session={session}
          isShowingLabels={isShowingLabels}
          onNavigate={onNavigate}
        />
        <div className="flex items-center gap-2.5 px-1.5" title={session?.user.name}>
          <span className="grid size-7 shrink-0 place-items-center">
            <UserRound className="size-4" />
          </span>
          <span className={cn("min-w-0 text-sm", !isShowingLabels && "sr-only")}>
            <b className="block truncate font-medium text-sidebar-accent-foreground">
              {session?.user.name ?? "Loading user…"}
            </b>
            <span className="block truncate text-xs">
              {session?.roleIds.join(", ") || "no role"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
