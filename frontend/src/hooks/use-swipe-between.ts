// Phone record gestures follow the list without taking over vertical or sideways scrolling.

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";

export interface SwipeHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  style?: CSSProperties;
}

export interface SwipePeek {
  side: "previous" | "next";
  label: string;
}

export interface RecordSwipe<Item> {
  items: readonly Item[];
  idOf: (item: Item) => string;
  labelOf: (item: Item) => string;
  currentId: string | null;
  onSelect: (id: string) => void;
  onNearEnd?: () => void;
}

type Point = { x: number; y: number; time: number };
export function swipeDirection(dx: number, dy: number) {
  return Math.abs(dx) >= 12 && Math.abs(dx) > 1.5 * Math.abs(dy)
    ? dx < 0
      ? "next"
      : "previous"
    : null;
}
export function swipeCommits(dx: number, width: number, elapsed: number) {
  return (
    Math.abs(dx) >= width * 0.3 ||
    (Math.abs(dx) >= 48 && elapsed > 0 && Math.abs(dx) / elapsed > 0.5)
  );
}
export function isEdgeZone(x: number, width: number) {
  return x <= 24 || width - x <= 24;
}
export function hasNeighbour(direction: "previous" | "next", index: number, length: number) {
  return direction === "previous" ? index > 0 : index >= 0 && index < length - 1;
}
export function isNearEnd(index: number, length: number) {
  return length - index <= 3;
}

export function useSwipeBetween<Item>(
  options: RecordSwipe<Item> & {
    isEnabled: boolean;
  },
): { bind: SwipeHandlers; peek: SwipePeek | null; previous?: Item; next?: Item } {
  const { items, currentId, idOf, labelOf, onSelect, onNearEnd, isEnabled } = options;
  const currentIndex = items.findIndex((item) => idOf(item) === currentId);
  const previous = currentIndex > 0 ? items[currentIndex - 1] : undefined;
  const next = currentIndex >= 0 ? items[currentIndex + 1] : undefined;
  const start = useRef<Point | null>(null);
  const [offset, setOffset] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [peek, setPeek] = useState<SwipePeek | null>(null);
  const finish = () => {
    start.current = null;
    setOffset(0);
    setIsFollowing(false);
    setPeek(null);
  };
  return {
    previous,
    next,
    bind: {
      onPointerDown(event) {
        const ownDialog = event.currentTarget.closest('[role="dialog"], [role="alertdialog"]');
        const openDialogs =
          typeof document === "undefined"
            ? []
            : document.querySelectorAll(
                '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
              );
        if ([...openDialogs].some((dialog) => dialog !== ownDialog)) return;
        if (
          !isEnabled ||
          event.pointerType !== "touch" ||
          isEdgeZone(event.clientX, window.innerWidth)
        )
          return;
        if (
          (event.target as Element).closest(
            "input, textarea, select, [contenteditable], [data-swipe='off']",
          )
        )
          return;
        start.current = { x: event.clientX, y: event.clientY, time: performance.now() };
      },
      onPointerMove(event) {
        const origin = start.current;
        if (origin === null) return;
        const dx = event.clientX - origin.x;
        const dir = swipeDirection(dx, event.clientY - origin.y);
        if (dir === null) return;
        const neighbour = dir === "next" ? next : previous;
        if (neighbour === undefined) return;
        setOffset(dx);
        setIsFollowing(true);
        setPeek({ side: dir, label: labelOf(neighbour) });
      },
      onPointerUp(event) {
        const origin = start.current;
        if (origin === null) return finish();
        const dx = event.clientX - origin.x;
        const direction = swipeDirection(dx, event.clientY - origin.y);
        const neighbour =
          direction === "next" ? next : direction === "previous" ? previous : undefined;
        if (
          neighbour !== undefined &&
          swipeCommits(
            dx,
            event.currentTarget.getBoundingClientRect().width,
            performance.now() - origin.time,
          )
        ) {
          const index = currentIndex + (direction === "next" ? 1 : -1);
          onSelect(idOf(neighbour));
          if (isNearEnd(index, items.length)) onNearEnd?.();
        }
        finish();
      },
      onPointerCancel: finish,
      style: {
        transform: `translateX(${offset}px)`,
        transition:
          isFollowing ||
          (typeof window !== "undefined" &&
            window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
            ? "none"
            : "transform 200ms ease-out",
      },
    },
    peek,
  };
}

export function useSwipeToClose(onClose: () => void): SwipeHandlers {
  const start = useRef<Point | null>(null);
  return {
    onPointerDown(event) {
      if (event.pointerType === "touch")
        start.current = { x: event.clientX, y: event.clientY, time: performance.now() };
    },
    onPointerMove() {},
    onPointerUp(event) {
      const origin = start.current;
      start.current = null;
      if (
        origin &&
        event.clientY - origin.y >= 80 &&
        event.clientY - origin.y > 1.5 * Math.abs(event.clientX - origin.x)
      )
        onClose();
    },
    onPointerCancel() {
      start.current = null;
    },
  };
}
