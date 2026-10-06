// The application frame. It fills the viewport and never scrolls itself: each view lays out its
// header and body in the column beside the sidebar and scrolls only its own regions.
// From the notebook tier up the sidebar is docked; below it ☰ before each page's title opens it
// as a sheet (component-interfaces.md §8). Collapsed, the rail opens over the content on hover
// (navigation.md §4.2): the aside keeps the rail's width in the layout and the bar inside it
// grows, so the content never moves. The tier is stamped on <html> as `data-tier`, which sets
// the root size.
// TODO(rrandiak): phone gestures (component-interfaces.md §8.1); labels move to i18n.

import { useLayoutEffect, useState } from "react";
import { Outlet } from "react-router";
import { OpenNavigationContext } from "@/components/layout/navigation-button";
import { Sidebar } from "@/components/layout/sidebar";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useSidebarPeek } from "@/hooks/use-sidebar-peek";
import { useSidebarPreference } from "@/hooks/use-sidebar-preference";
import { useTier } from "@/hooks/use-tier";
import { cn } from "@/lib/utils";

export function AppShell() {
  const { data: session } = useSessionQuery();
  const sidebar = useSidebarPreference();
  const tier = useTier();
  const isDocked = tier === "notebook" || tier === "large";
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const peek = useSidebarPeek(isDocked && !sidebar.isExpanded);

  // Before paint, so the large tier never shows a frame at the wrong size.
  useLayoutEffect(() => {
    document.documentElement.dataset.tier = tier;
  }, [tier]);

  const toggleSidebar = () => {
    peek.hold();
    sidebar.toggle();
  };

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <aside
        className={cn(
          "relative z-40 hidden shrink-0 transition-[width] duration-200 xl:block",
          sidebar.isExpanded ? "w-66" : "w-14",
        )}
      >
        <div {...peek.barProps} className="absolute inset-y-0 left-0">
          <Sidebar
            session={session}
            isExpanded={sidebar.isExpanded}
            isPeeking={peek.isPeeking}
            onToggle={toggleSidebar}
            onNavigate={peek.hold}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex min-h-0 flex-1 flex-col">
          <OpenNavigationContext value={isDocked ? null : () => setIsSheetOpen(true)}>
            <Outlet />
          </OpenNavigationContext>
        </main>
      </div>

      <Sheet open={isSheetOpen && !isDocked} onOpenChange={setIsSheetOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-auto gap-0 border-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">The views this account can open.</SheetDescription>
          <Sidebar session={session} isExpanded onNavigate={() => setIsSheetOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
