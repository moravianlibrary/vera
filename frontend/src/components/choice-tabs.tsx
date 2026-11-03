// A wrapped set of choices within a dialog or card, rather than a page's tab strip.

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { i18n } from "@/i18n";

export interface ChoicePanel<Value extends string> {
  value: Value;
  label: string;
  content: ReactNode;
}

export function ChoiceTabs<Value extends string>({
  value,
  onChange,
  panels,
  label,
}: {
  value: Value;
  onChange: (value: Value) => void;
  panels: readonly ChoicePanel<Value>[];
  label: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measureEdges = useCallback(() => {
    const list = listRef.current;
    if (list === null) return;
    const next = {
      left: list.scrollLeft > 1,
      right: list.scrollLeft + list.clientWidth < list.scrollWidth - 1,
    };
    setEdges((current) =>
      current.left === next.left && current.right === next.right ? current : next,
    );
  }, []);

  const panelCount = panels.length;
  useEffect(() => {
    const list = listRef.current;
    if (list === null) return;
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measureEdges);
    observer?.observe(list);
    for (let index = 0; index < panelCount; index += 1) {
      const trigger = list.children.item(index);
      if (trigger !== null) observer?.observe(trigger);
    }
    measureEdges();
    return () => {
      observer?.disconnect();
    };
  }, [measureEdges, panelCount]);

  const scrollByTab = (direction: -1 | 1) => {
    const list = listRef.current;
    if (list === null) return;
    const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
    const amount = active?.getBoundingClientRect().width ?? list.clientWidth * 0.75;
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollBy({ left: direction * amount, behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <Tabs
      value={value}
      onValueChange={(picked) => {
        onChange(picked as Value);
        requestAnimationFrame(() => {
          const reducedMotion =
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          listRef.current
            ?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
            ?.scrollIntoView({
              inline: "nearest",
              behavior: reducedMotion ? "auto" : "smooth",
            });
        });
      }}
    >
      <div className="relative w-full min-w-0 sm:contents">
        <TabsList
          ref={listRef}
          aria-label={label}
          onScroll={measureEdges}
          className="flex w-full max-w-full flex-nowrap justify-start overflow-x-auto [scrollbar-width:thin] sm:w-fit sm:flex-wrap sm:h-auto"
        >
          {panels.map((panel) => (
            <TabsTrigger key={panel.value} value={panel.value} className="flex-none sm:flex-1">
              {panel.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {edges.left && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center bg-gradient-to-r from-muted via-muted/90 to-transparent pr-2 sm:hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              tabIndex={-1}
              aria-label={i18n.t("choiceTabs.scrollLeft", { ns: "common" })}
              className="pointer-events-auto"
              onClick={() => scrollByTab(-1)}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
          </div>
        )}
        {edges.right && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center bg-gradient-to-l from-muted via-muted/90 to-transparent pl-2 sm:hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              tabIndex={-1}
              aria-label={i18n.t("choiceTabs.scrollRight", { ns: "common" })}
              className="pointer-events-auto"
              onClick={() => scrollByTab(1)}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
      {panels.map((panel) => (
        <TabsContent key={panel.value} value={panel.value} className="pt-2">
          {panel.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
