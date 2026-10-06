// The strip at the top of every view, on one line at every tier: ☰ where the sidebar is a sheet,
// the title, and the view's declared actions on the right, capped per tier
// (docs/demos/shared/vera.css § top bar; component-interfaces.md §1.1). Counts belong to the
// list they count, not here. It never scrolls; the view's body below it does.

import type { ReactNode } from "react";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import { NavigationButton } from "@/components/layout/navigation-button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  // Already narrowed to what the person may do.
  actions?: readonly ViewAction[];
  className?: string;
}

export function PageHeader({ title, actions = [], className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center gap-x-2 border-b bg-background px-4 sm:px-6",
        className,
      )}
    >
      <NavigationButton />
      <h1 className="min-w-0 flex-1 truncate text-lg leading-7 font-semibold">{title}</h1>
      <ActionBar actions={actions} className="shrink-0" />
    </header>
  );
}

interface PageContentProps {
  children: ReactNode;
  className?: string;
}

// The scrolling body of a view that is not split into master and detail.
export function PageContent({ children, className }: PageContentProps) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6", className)}>
      {children}
    </div>
  );
}
