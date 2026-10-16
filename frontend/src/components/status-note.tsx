// The reason beside a status as a toned strip, "{title}: {text}", above a record's facts
// (docs/demos/shared/vera.css § status footnote). Only something worth stopping for gets one.

import type { ReactNode } from "react";
import type { NoteTone } from "@/lib/status-notes";
import { cn } from "@/lib/utils";

const toneClasses = {
  slate: "bg-muted text-muted-foreground",
  amber: "bg-tone-amber/50 text-tone-amber-foreground",
  red: "bg-tone-red/50 text-tone-red-foreground",
  blue: "bg-tone-blue/50 text-tone-blue-foreground",
  purple: "bg-tone-purple/50 text-tone-purple-foreground",
  green: "bg-tone-green/50 text-tone-green-foreground",
} as const satisfies Record<NoteTone, string>;

interface StatusNoteProps {
  tone: NoteTone;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}

export function StatusNote({ tone, title, children, className }: StatusNoteProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 border-l-[3px] border-current px-3.5 py-2 text-xs leading-normal",
        toneClasses[tone],
        className,
      )}
    >
      <span aria-hidden className="shrink-0 text-[0.625rem] leading-[1.125rem]">
        ▼
      </span>
      <p>
        <b className="font-semibold">{title}:</b>{" "}
        <span className="text-muted-foreground">{children}</span>
      </p>
    </div>
  );
}
