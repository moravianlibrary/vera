// The application frame. It fills the viewport and never scrolls itself: each view lays out its
// header and body in the column beside the sidebar and scrolls only its own regions.
// From the notebook tier up the sidebar is docked; below it a bar with a hamburger opens it as a
// sheet (navigation.md §3). Collapsed, the rail opens over the content on hover (§4.2): the aside
// keeps the rail's width in the layout and the bar inside it grows, so the content never moves.
// TODO(rrandiak): phone bottom tabs (navigation.md §3); labels move to i18n.

import { Menu } from "lucide-react";
import { useState } from "react";
import { Outlet } from "react-router";
import { Sidebar } from "@/components/layout/sidebar";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useSidebarPeek } from "@/hooks/use-sidebar-peek";
import { useSidebarPreference } from "@/hooks/use-sidebar-preference";
import { cn } from "@/lib/utils";

// Tailwind `xl`, the `notebook` tier boundary: at this width and wider the sidebar is docked.
const dockedQuery = "(min-width: 1280px)";

export function AppShell() {
  const { data: session } = useSessionQuery();
  const sidebar = useSidebarPreference();
  const isDocked = useMediaQuery(dockedQuery);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const peek = useSidebarPeek(isDocked && !sidebar.isExpanded);

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
        <header className="flex h-14 shrink-0 items-center justify-between bg-sidebar px-4 xl:hidden">
          <span className="flex items-center gap-2.5 font-semibold text-sidebar-accent-foreground">
            <Logo
              className="size-7 text-sidebar-primary"
              markClassName="fill-sidebar-primary-foreground"
            />
            VERA
          </span>

          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => setIsSheetOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          <Outlet />
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
