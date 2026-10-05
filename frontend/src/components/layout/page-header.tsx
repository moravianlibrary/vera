// The strip at the top of every view: the title and the view's actions on the right
// (docs/demos/shared/vera.css § top bar). Counts belong to the list they count, not here. It
// never scrolls; the view's body below it does.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background px-4 py-3 sm:px-6",
        className,
      )}
    >
      <h1 className="min-w-0 truncate text-lg leading-7 font-semibold">{title}</h1>

      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
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
