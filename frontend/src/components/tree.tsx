// A tree to pick one node from, beside a pane (component-interfaces.md §2.5; docs/demos/shared/
// vera.css .ca-row): a row per node, indented by depth, with a toggle on a branch, a ⚠ where
// something under it needs a look, and a number on the right. A virtual root may stand above the
// roots, selected when nothing else is; it is always open. Dimmed rows stay selectable. One row
// is in the tab order; the arrow keys move between rows, open and close branches, Home and End
// jump, and Enter or Space selects (WAI-ARIA tree view).
// TODO(rrandiak): labels move to i18n.

import { ChevronDown, ChevronRight } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface TreeProps<Node> {
  // Names the tree for assistive technology.
  ariaLabel: string;
  roots: readonly Node[];
  childrenOf: (node: Node) => readonly Node[];
  nodeId: (node: Node) => string;
  label: (node: Node) => ReactNode;
  value?: (node: Node) => ReactNode;
  // The ⚠'s title; null for none.
  warning?: (node: Node) => string | null;
  isDimmed?: (node: Node) => boolean;
  // Null selects the virtual root.
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  expandedIds: ReadonlySet<string>;
  onExpandedChange: (ids: ReadonlySet<string>) => void;
  virtualRoot?: {
    label: string;
    value?: ReactNode;
    warning?: string | null;
    isDimmed?: boolean;
  };
}

interface Row<Node> {
  // The virtual root's is the empty string.
  key: string;
  node: Node | null;
  depth: number;
  parentKey: string | null;
  hasChildren: boolean;
  isExpanded: boolean;
}

const rootKey = "";

export function Tree<Node>({
  ariaLabel,
  roots,
  childrenOf,
  nodeId,
  label,
  value,
  warning,
  isDimmed,
  selectedId,
  onSelect,
  expandedIds,
  onExpandedChange,
  virtualRoot,
}: TreeProps<Node>) {
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const selectedKey = selectedId ?? rootKey;
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const rows: Row<Node>[] = [];
  const depthOffset = virtualRoot === undefined ? 0 : 1;
  if (virtualRoot !== undefined) {
    rows.push({
      key: rootKey,
      node: null,
      depth: 0,
      parentKey: null,
      hasChildren: roots.length > 0,
      isExpanded: true,
    });
  }

  const walk = (nodes: readonly Node[], depth: number, parentKey: string | null) => {
    for (const node of nodes) {
      const key = nodeId(node);
      const children = childrenOf(node);
      const isExpanded = expandedIds.has(key);
      rows.push({ key, node, depth, parentKey, hasChildren: children.length > 0, isExpanded });
      if (children.length > 0 && isExpanded) {
        walk(children, depth + 1, key);
      }
    }
  };
  walk(roots, depthOffset, virtualRoot === undefined ? null : rootKey);

  // The selected row takes the tab stop; one hidden by a closed branch hands it to the first.
  const tabKey =
    rows.find((row) => row.key === focusKey)?.key ??
    rows.find((row) => row.key === selectedKey)?.key ??
    rows[0]?.key;

  const toggle = (key: string) => {
    const next = new Set(expandedIds);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }

    onExpandedChange(next);
  };
  const moveTo = (key: string | undefined) => {
    if (key === undefined) {
      return;
    }

    setFocusKey(key);
    rowRefs.current.get(key)?.focus();
  };
  const selectRow = (row: Row<Node>) => onSelect(row.node === null ? null : row.key);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const row = rows[index];
    if (row === undefined) {
      return;
    }

    const isBranch = row.hasChildren && row.node !== null;
    switch (event.key) {
      case "ArrowDown":
        moveTo(rows[index + 1]?.key);
        break;
      case "ArrowUp":
        moveTo(rows[index - 1]?.key);
        break;
      case "Home":
        moveTo(rows[0]?.key);
        break;
      case "End":
        moveTo(rows.at(-1)?.key);
        break;
      case "ArrowRight":
        if (isBranch && !row.isExpanded) {
          toggle(row.key);
        } else if (row.hasChildren) {
          moveTo(rows[index + 1]?.key);
        }
        break;
      case "ArrowLeft":
        if (isBranch && row.isExpanded) {
          toggle(row.key);
        } else if (row.parentKey !== null) {
          moveTo(row.parentKey);
        }
        break;
      case "Enter":
      case " ":
        selectRow(row);
        break;
      default:
        return;
    }

    event.preventDefault();
  };

  return (
    <div role="tree" aria-label={ariaLabel} className="text-sm">
      {rows.map((row, index) => {
        const { node } = row;
        const isRoot = node === null;
        const rowWarning = isRoot ? (virtualRoot?.warning ?? null) : (warning?.(node) ?? null);
        const isRowDimmed = isRoot ? virtualRoot?.isDimmed === true : isDimmed?.(node) === true;
        const isSelected = row.key === selectedKey;
        const isBranch = row.hasChildren && !isRoot;
        return (
          <div
            key={row.key}
            ref={(element) => {
              if (element === null) {
                rowRefs.current.delete(row.key);
              } else {
                rowRefs.current.set(row.key, element);
              }
            }}
            role="treeitem"
            aria-level={row.depth + 1}
            aria-selected={isSelected}
            aria-expanded={row.hasChildren ? row.isExpanded : undefined}
            tabIndex={row.key === tabKey ? 0 : -1}
            onClick={() => selectRow(row)}
            onFocus={() => setFocusKey(row.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "flex min-h-9 cursor-pointer items-center gap-1.5 border-b border-l-3 border-l-transparent pr-4 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              isRoot && "bg-muted/50",
              isSelected && "border-l-foreground bg-muted",
            )}
            style={{ paddingLeft: `${0.5 + row.depth * 1.125}rem` }}
          >
            {isBranch ? (
              <button
                type="button"
                tabIndex={-1}
                aria-label={row.isExpanded ? "Collapse" : "Expand"}
                className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  toggle(row.key);
                }}
              >
                {row.isExpanded ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </button>
            ) : (
              <span className="size-5 shrink-0" />
            )}
            <span
              className={cn(
                "min-w-0 flex-1 truncate py-1.5",
                (row.hasChildren || isRoot) && "font-semibold",
                isRowDimmed && "text-muted-foreground",
              )}
            >
              {isRoot ? virtualRoot?.label : label(node)}
            </span>
            {rowWarning !== null && (
              <span
                className="shrink-0 text-tone-amber-foreground"
                title={rowWarning}
                role="img"
                aria-label={rowWarning}
              >
                ⚠
              </span>
            )}
            <span className="shrink-0 text-right text-[0.8125rem] tabular-nums">
              {isRoot ? virtualRoot?.value : value?.(node)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
