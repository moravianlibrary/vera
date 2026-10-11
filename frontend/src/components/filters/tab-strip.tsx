import type { ComponentProps, ReactNode, Ref } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

export function TabStrip({
  label,
  children,
  navRef,
}: {
  label: string;
  children: ReactNode;
  navRef?: Ref<HTMLElement>;
}) {
  return (
    <div className="flex shrink-0 items-end border-b px-4 sm:px-6">
      <nav
        ref={navRef}
        aria-label={label}
        className="-mb-px flex min-w-0 flex-1 items-end overflow-x-auto [scrollbar-width:thin]"
      >
        {children}
      </nav>
    </div>
  );
}

function tabClassName(selected: boolean, className?: string) {
  return cn(
    "inline-flex h-9 shrink-0 items-center gap-1.5 border-b-2 px-3 text-[0.8125rem] whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    selected
      ? "border-primary font-medium text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
    className,
  );
}

export function TabButton({
  selected,
  className,
  ...props
}: ComponentProps<"button"> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-current={selected ? "page" : undefined}
      className={tabClassName(selected, className)}
      {...props}
    />
  );
}

export function TabLink({
  selected,
  className,
  ...props
}: ComponentProps<typeof Link> & { selected: boolean }) {
  return (
    <Link
      aria-current={selected ? "page" : undefined}
      className={tabClassName(selected, className)}
      {...props}
    />
  );
}
