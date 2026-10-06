// A list beside a pane that answers in full (docs/demos/shared/vera.css § master–detail). It
// takes the height left under the view's header and filters, and the list and the docked pane
// scroll independently. Docked, the list takes half the room and never less than a card's width;
// it is a container, so its rows lay themselves out by its width. The pane docks at every tier
// but the phone, the small tier included (view-rules.md §1.5); on a phone it opens as a sheet
// over the list.

import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

// Tailwind `md`, the small tier's lower edge: at this width and wider the detail is docked.
const splitQuery = "(min-width: 768px)";

interface MasterDetailProps {
  master: ReactNode;
  detail: ReactNode;
  detailTitle: string;
  detailDescription?: string;
  detailOpen: boolean;
  onDetailOpenChange: (open: boolean) => void;
  className?: string;
}

export function MasterDetail({
  master,
  detail,
  detailTitle,
  detailDescription,
  detailOpen,
  onDetailOpenChange,
  className,
}: MasterDetailProps) {
  // The sheet is modal; left open on a wide screen it would dim and block the docked pane.
  const isSplit = useMediaQuery(splitQuery);

  return (
    <div className={cn("flex min-h-0 flex-1", className)}>
      <section
        aria-label="Items"
        className="@container min-w-0 flex-1 overflow-y-auto bg-background md:w-1/2 md:min-w-86 md:flex-none md:border-r"
      >
        {master}
      </section>

      <aside
        aria-label={detailTitle}
        className="hidden min-w-0 flex-1 overflow-y-auto px-4 py-4 md:block lg:px-6 lg:py-5"
      >
        {detail}
      </aside>

      <Sheet open={detailOpen && !isSplit} onOpenChange={onDetailOpenChange}>
        <SheetContent side="right" className="w-full max-w-none gap-0 p-0 md:hidden sm:max-w-none">
          <SheetHeader className="border-b px-5 py-4 text-left">
            <SheetTitle>{detailTitle}</SheetTitle>
            {detailDescription ? <SheetDescription>{detailDescription}</SheetDescription> : null}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">{detail}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
