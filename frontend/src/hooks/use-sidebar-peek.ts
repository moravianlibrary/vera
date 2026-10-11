// Whether the collapsed rail is showing the expanded bar for a moment (navigation.md §4.2).
// With a fine pointer it opens after a short hover and closes as soon as the pointer leaves;
// without one, a tap on the rail opens it and a tap outside closes it. Keyboard focus opens it
// too and keeps it open while focus stays inside. After a navigation it stays shut until the
// pointer has left the bar once, since the cursor is usually still over the rail.

import type { FocusEvent, MouseEvent, PointerEvent, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";

const hoverQuery = "(hover: hover) and (pointer: fine)";

// Long enough that a cursor crossing to the content does not open it.
const openDelayMilliseconds = 200;

// Marks a control inside the bar that acts at once, even on a closed rail.
export const sidebarImmediateAttribute = { "data-sidebar-immediate": "" } as const;
const immediateSelector = "[data-sidebar-immediate]";

export function useSidebarPeek(isEnabled: boolean) {
  const canHover = useMediaQuery(hoverQuery);
  const [isPeeking, setIsPeeking] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const isHeldRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const cancelOpen = () => clearTimer(timerRef);

  // Shut, and stay shut until the pointer has left the bar.
  const hold = () => {
    cancelOpen();
    isHeldRef.current = true;
    setIsPeeking(false);
    setIsPinned(false);
  };

  // Collapsing with the pointer still over the bar leaves its labels visible until the pointer
  // leaves. There is no new pointer-enter event after the click to open it otherwise.
  const revealUnderPointer = () => {
    cancelOpen();
    isHeldRef.current = false;
    setIsPeeking(canHover && !!barRef.current?.matches(":hover"));
  };

  // A dropdown is portaled outside the rail. Keep the rail expanded while its menu is open.
  const pin = (open: boolean) => {
    setIsPinned(open);
    if (open) {
      cancelOpen();
      setIsPeeking(true);
    } else if (!barRef.current?.matches(":hover") && !hasVisibleFocus()) {
      setIsPeeking(false);
    }
  };

  useEffect(() => {
    if (!isEnabled) {
      clearTimer(timerRef);
      setIsPeeking(false);
      setIsPinned(false);
    }
  }, [isEnabled]);

  useEffect(() => () => clearTimer(timerRef), []);

  // Without hover the bar closes on a tap anywhere else.
  useEffect(() => {
    if (!isPeeking || canHover || isPinned) {
      return;
    }

    const closeOutside = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && barRef.current?.contains(event.target)) {
        return;
      }

      setIsPeeking(false);
    };

    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [isPeeking, canHover, isPinned]);

  const onPointerEnter = (event: PointerEvent) => {
    if (!isEnabled || !canHover || event.pointerType !== "mouse" || isHeldRef.current) {
      return;
    }

    cancelOpen();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setIsPeeking(true);
    }, openDelayMilliseconds);
  };

  const onPointerLeave = (event: PointerEvent) => {
    if (!canHover || event.pointerType !== "mouse") {
      return;
    }

    cancelOpen();
    isHeldRef.current = false;
    if (isPinned) return;
    if (!barRef.current?.contains(document.activeElement) || !hasVisibleFocus()) {
      setIsPeeking(false);
    }
  };

  // Only keyboard focus opens it: a mouse click also focuses the link it lands on.
  const onFocus = (event: FocusEvent) => {
    if (isEnabled && event.target.matches(":focus-visible")) {
      setIsPeeking(true);
    }
  };

  const onBlur = (event: FocusEvent) => {
    if (isPinned) return;
    if (event.relatedTarget instanceof Node && barRef.current?.contains(event.relatedTarget)) {
      return;
    }

    if (!barRef.current?.matches(":hover")) {
      setIsPeeking(false);
    }
  };

  // A first tap on the closed rail opens it instead of following what it landed on.
  const onClickCapture = (event: MouseEvent) => {
    if (!isEnabled || canHover || isPeeking) {
      return;
    }

    if (event.target instanceof Element && event.target.closest(immediateSelector)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setIsPeeking(true);
  };

  return {
    isPeeking: isEnabled && (isPeeking || isPinned),
    hold,
    revealUnderPointer,
    pin,
    barProps: {
      ref: barRef,
      onPointerEnter,
      onPointerLeave,
      onFocus,
      onBlur,
      onClickCapture,
    },
  };
}

function clearTimer(timerRef: RefObject<number | null>): void {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

function hasVisibleFocus(): boolean {
  return document.activeElement?.matches(":focus-visible") ?? false;
}
