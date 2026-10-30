// A row long-press starts bulk picking without stealing mouse or scrolling gestures.

import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useRef } from "react";

interface LongPressOptions {
  isEnabled: boolean;
}

export function useLongPress(
  onLongPress: () => void,
  { isEnabled }: LongPressOptions,
): {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
} {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  };
  return {
    onPointerDown(event) {
      cancel();
      fired.current = false;
      if (!isEnabled || event.pointerType !== "touch") return;
      origin.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        fired.current = true;
        onLongPress();
      }, 500);
    },
    onPointerMove(event) {
      const start = origin.current;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu(event) {
      if (isEnabled) event.preventDefault();
    },
  };
}
