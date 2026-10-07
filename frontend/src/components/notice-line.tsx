// What was just done, said where it was done, until it is dismissed (docs/demos/shared/vera-ui.js
// `saved`): a status note with *Dismiss* beside it, and room for a link onwards, such as the run
// an act started. Users & Groups, Tasks and Plugins say their acts this way.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import { StatusNote } from "@/components/status-note";
import type { NoteTone } from "@/domain/status-notes";
import { cn } from "@/lib/utils";

interface NoticeLineProps {
  tone: NoteTone;
  title: string;
  children: ReactNode;
  onDismiss: () => void;
  className?: string;
}

export function NoticeLine({ tone, title, children, onDismiss, className }: NoticeLineProps) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <StatusNote tone={tone} title={title} className="flex-1">
        {children}
      </StatusNote>
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  );
}
