// The frame of a header over a group of list rows (component-interfaces.md §2.3): a title, a
// line about the group, and the group's action with what it leaves out. It spans every column
// of a table. The view says what the group is; the frame is the same for all.

import type { ReactNode } from "react";

export interface GroupHeaderProps {
  // "B-2026-014 · Catalogue import".
  title: ReactNode;
  // "by Jana, 3 Sep · via file".
  meta?: ReactNode;
  // "Approve 9…", "Retry failed"; absent where the caller may not.
  action?: ReactNode;
  // What the action leaves out: "2 rescans, 1 still being checked left out".
  footnote?: ReactNode;
}

export function GroupHeader({ title, meta, action, footnote }: GroupHeaderProps) {
  return (
    <div className="border-t-2 border-b border-l-4 border-t-foreground/30 border-l-foreground/50 bg-muted px-4 py-3 text-xs @2xl:col-span-full">
      <div className="text-sm leading-snug font-semibold">{title}</div>
      {meta !== undefined && <div className="mt-1 text-muted-foreground">{meta}</div>}

      {action !== undefined && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {action}
          {footnote !== undefined && <span className="text-muted-foreground">{footnote}</span>}
        </div>
      )}
    </div>
  );
}
