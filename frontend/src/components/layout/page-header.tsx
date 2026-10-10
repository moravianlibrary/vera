// The strip at the top of every view, on one line at every tier: ☰ where the sidebar is a sheet,
// the title, and the view's declared actions on the right, capped per tier
// (docs/demos/shared/vera.css § top bar; component-interfaces.md §1.1). Counts belong to the
// list they count, not here. It never scrolls; the view's body below it does. A control that
// picks what the whole view reads sits before the actions, and on a phone wraps to a line of its
// own.

import { ChevronLeft } from "lucide-react";
import type { ReactNode, UIEventHandler } from "react";
import { Link } from "react-router";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import { NavigationButton } from "@/components/layout/navigation-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  // Already narrowed to what the person may do.
  actions?: readonly ViewAction[];
  // On a record's own page, the way back to its index, and a word on where the record stands.
  breadcrumb?: { label: string; href: string; detail?: string };
  back?: { label: string; href: string };
  control?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  actions = [],
  breadcrumb,
  back,
  control,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex min-h-14 shrink-0 items-center gap-x-2 border-b bg-background px-4 sm:px-6",
        control === undefined ? "h-14" : "flex-wrap gap-y-2 py-2 md:h-14 md:flex-nowrap md:py-0",
        className,
      )}
    >
      <NavigationButton />
      {back !== undefined && (
        <Button asChild size="icon" variant="outline" className="size-8 shrink-0">
          <Link to={back.href} aria-label={back.label} title={back.label}>
            <ChevronLeft />
          </Link>
        </Button>
      )}
      {breadcrumb === undefined ? (
        <h1 className="min-w-0 flex-1 truncate text-lg leading-7 font-semibold">{title}</h1>
      ) : (
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base leading-6 font-semibold">{title}</h1>
          <p className="truncate text-xs text-muted-foreground">
            <Link to={breadcrumb.href} className="hover:text-foreground hover:underline">
              {breadcrumb.label}
            </Link>
            {breadcrumb.detail !== undefined && ` · ${breadcrumb.detail}`}
          </p>
        </div>
      )}
      {control !== undefined && (
        <div className="order-last w-full min-w-0 md:order-none md:w-auto md:max-w-lg">
          {control}
        </div>
      )}
      <ActionBar actions={actions} className="shrink-0" />
    </header>
  );
}

interface PageContentProps {
  children: ReactNode;
  className?: string;
  onScroll?: UIEventHandler<HTMLDivElement>;
}

// The scrolling body of a view that is not split into master and detail.
export function PageContent({ children, className, onScroll }: PageContentProps) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6", className)}
      onScroll={onScroll}
    >
      {children}
    </div>
  );
}
