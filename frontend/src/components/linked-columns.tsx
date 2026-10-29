// Records side by side in columns, with what the selected one is connected to lit up and the rest
// dimmed, and the links drawn as lines in the gutters (component-interfaces.md §1.7; docs/demos/
// shared/page-access.js `columns`, `drawLines`). A column holds one or more sections, each one
// kind of record; a record of the selected kind is never dimmed, so the others stay a click
// away. A line runs from the right edge of a record to the left edge of one in a later column,
// solid or dashed. The selected record is shown underneath. A phone has no room for lines: each
// section is a tab, and a link shows only as the tag on the record.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useTier } from "@/hooks/use-tier";
import { cn } from "@/lib/utils";

export interface LinkedItem {
  id: string;
  title: ReactNode;
  // Said beside the title: "agent", "fallback".
  badge?: ReactNode;
  sub: ReactNode;
}

export interface LinkedSection<Kind extends string = string> {
  kind: Kind;
  title: string;
  // On a phone's tab.
  tabTitle: string;
  items: readonly LinkedItem[];
  emptyText: string;
}

export interface LinkedLine {
  // `kind:id` of a record in an earlier column, and of one in a later column.
  from: string;
  to: string;
  isDashed: boolean;
}

export interface LinkedSelection<Kind extends string = string> {
  kind: Kind;
  id: string;
}

interface LinkedColumnsProps<Kind extends string> {
  // Left to right; each a list of sections, top to bottom.
  columns: readonly (readonly LinkedSection<Kind>[])[];
  // The phone's tabs, in their order, by section kind.
  tabOrder: readonly Kind[];
  selected: LinkedSelection<Kind>;
  // What each record is to the selected one, by `kind:id`: "member", "via Reading Room".
  tags: ReadonlyMap<string, LinkedTag>;
  lines: readonly LinkedLine[];
  onSelect: (selection: LinkedSelection<Kind>) => void;
  // The selected record, underneath.
  record: ReactNode;
}

export interface LinkedTag {
  text: string;
  // Held by hand reads apart from every other link.
  isDirect?: boolean;
}

export const linkKeyOf = (kind: string, id: string) => `${kind}:${id}`;

export function LinkedColumns<Kind extends string>({
  columns,
  tabOrder,
  selected,
  tags,
  lines,
  onSelect,
  record,
}: LinkedColumnsProps<Kind>) {
  const isPhone = useTier() === "phone";
  const sections = columns.flat();
  const [tab, setTab] = useState<Kind>(selected.kind);
  // A record selected from elsewhere (one named in a record, one just made) opens its own tab.
  const [tabbedKind, setTabbedKind] = useState<Kind>(selected.kind);
  if (selected.kind !== tabbedKind) {
    setTabbedKind(selected.kind);
    setTab(selected.kind);
  }
  const recordRef = useRef<HTMLDivElement>(null);

  const select = (selection: LinkedSelection<Kind>) => {
    onSelect(selection);
    if (isPhone) {
      requestAnimationFrame(() =>
        recordRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
      );
    }
  };

  const sectionView = (section: LinkedSection<Kind>) => (
    <Section
      key={section.kind}
      section={section}
      selected={selected}
      tags={tags}
      onSelect={select}
    />
  );

  if (isPhone) {
    const current = sections.find((section) => section.kind === tab) ?? sections[0];
    return (
      <>
        <div role="tablist" className="mb-3 flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {tabOrder.flatMap((kind) => {
            const section = sections.find((candidate) => candidate.kind === kind);
            if (section === undefined) {
              return [];
            }

            const isCurrent = section.kind === current?.kind;
            return [
              <button
                key={kind}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                onClick={() => setTab(kind)}
                className={cn(
                  "flex shrink-0 items-baseline gap-1.5 rounded-md px-3 py-1.5 text-sm",
                  isCurrent
                    ? "bg-foreground font-medium text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {section.tabTitle}
                <span className="text-xs opacity-70">{section.items.length}</span>
              </button>,
            ];
          })}
        </div>
        {current !== undefined && <div className="grid gap-1.5">{sectionView(current)}</div>}
        <div ref={recordRef} className="mt-5 scroll-mt-4">
          {record}
        </div>
      </>
    );
  }

  return (
    <>
      <LinedColumns lines={lines} selectedKey={linkKeyOf(selected.kind, selected.id)}>
        {columns.map((column) => (
          <div key={column.map(({ kind }) => kind).join()} className="grid content-start gap-5">
            {column.map((section) => (
              <div key={section.kind} className="grid gap-1.5">
                {sectionView(section)}
              </div>
            ))}
          </div>
        ))}
      </LinedColumns>
      <div className="mt-5">{record}</div>
    </>
  );
}

function Section<Kind extends string>({
  section,
  selected,
  tags,
  onSelect,
}: {
  section: LinkedSection<Kind>;
  selected: LinkedSelection<Kind>;
  tags: ReadonlyMap<string, LinkedTag>;
  onSelect: (selection: LinkedSelection<Kind>) => void;
}) {
  return (
    <>
      <h2 className="flex items-baseline gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {section.title}
        <span className="font-normal">{section.items.length}</span>
      </h2>
      {section.items.length === 0 && (
        <p className="text-xs text-muted-foreground">{section.emptyText}</p>
      )}
      {section.items.map((item) => {
        const key = linkKeyOf(section.kind, item.id);
        const isSelected = selected.kind === section.kind && selected.id === item.id;
        const tag = tags.get(key);
        const isDimmed = !isSelected && tag === undefined && selected.kind !== section.kind;
        return (
          <button
            key={item.id}
            type="button"
            data-link-key={key}
            aria-pressed={isSelected}
            onClick={() => onSelect({ kind: section.kind, id: item.id })}
            className={cn(
              "relative z-2 flex min-w-0 items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left outline-none transition-opacity hover:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-ring/50",
              isSelected && "border-chart-2 bg-tone-blue ring-1 ring-chart-2",
              tag !== undefined && !isSelected && "border-chart-2/50",
              isDimmed && "opacity-45",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5 text-ui font-medium">
                <span className="truncate">{item.title}</span>
                {item.badge}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{item.sub}</span>
            </span>
            {tag !== undefined && (
              <span
                className={cn(
                  "max-w-[55%] shrink-0 truncate rounded-full px-2 py-px text-caption",
                  tag.isDirect
                    ? "bg-tone-purple text-tone-purple-foreground"
                    : "bg-tone-blue text-tone-blue-foreground",
                )}
              >
                {tag.text}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}

interface Path {
  key: string;
  d: string;
  isDashed: boolean;
}

// The columns, and an SVG over them with a curve from each link's left record to its right one.
// Measured after every layout and whenever the room changes size.
function LinedColumns({
  lines,
  selectedKey,
  children,
}: {
  lines: readonly LinkedLine[];
  selectedKey: string;
  children: ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<readonly Path[]>([]);

  const measure = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (wrapper === null) {
      return;
    }

    const box = wrapper.getBoundingClientRect();
    const edgeOf = (key: string, side: "left" | "right") => {
      const element = wrapper.querySelector(`[data-link-key="${CSS.escape(key)}"]`);
      if (element === null) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      return {
        x: (side === "right" ? rect.right : rect.left) - box.left,
        y: rect.top + rect.height / 2 - box.top,
      };
    };

    setPaths(
      lines.flatMap((line) => {
        const from = edgeOf(line.from, "right");
        const to = edgeOf(line.to, "left");
        if (from === null || to === null) {
          return [];
        }

        const middle = (from.x + to.x) / 2;
        return [
          {
            key: `${line.from}>${line.to}`,
            d: `M${from.x},${from.y} C${middle},${from.y} ${middle},${to.y} ${to.x},${to.y}`,
            isDashed: line.isDashed,
          },
        ];
      }),
    );
  }, [lines]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the selection moves the records the lines join.
  useLayoutEffect(() => {
    measure();
  }, [measure, selectedKey]);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper === null) {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div ref={wrapperRef} className="relative">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-1 size-full overflow-visible"
      >
        {paths.map((path) => (
          <path
            key={path.key}
            d={path.d}
            className="fill-none stroke-chart-2 opacity-75"
            strokeWidth={1.5}
            strokeDasharray={path.isDashed ? "4 3" : undefined}
          />
        ))}
      </svg>
      <div className="grid grid-cols-3 items-start gap-7 xl:gap-11">{children}</div>
    </div>
  );
}
