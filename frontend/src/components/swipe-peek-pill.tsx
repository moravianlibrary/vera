// The neighbour label stays beside the record while its body follows the finger.

import type { SwipePeek } from "@/hooks/use-swipe-between";

export function SwipePeekPill({ peek }: { peek: SwipePeek | null }) {
  if (!peek) return null;

  return (
    <span
      className={`pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground ${peek.side === "next" ? "right-2" : "left-2"}`}
    >
      {peek.side === "previous" ? `‹ ${peek.label}` : `${peek.label} ›`}
    </span>
  );
}
