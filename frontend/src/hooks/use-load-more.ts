// Asks for a list's next slice as its end nears: the returned ref goes on an empty element after
// the last row, and once it comes within reach of the list's scroll box the next slice is asked
// for. Re-armed after each slice, so a sentinel still in view asks again.

import { useEffect, useEffectEvent, useRef } from "react";

// How far below the visible rows the next slice is asked for, so scrolling rarely waits.
const loadAheadMargin = "800px";

export function useLoadMore(hasMore: boolean, isLoadingMore: boolean, onLoadMore: () => void) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMore = useEffectEvent(onLoadMore);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (sentinel === null || !hasMore || isLoadingMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      // Observed against the list's own scroll box: against the viewport, the list's clipping
      // would hide the margin and the sentinel would never be seen.
      { root: scrollContainerOf(sentinel), rootMargin: `0px 0px ${loadAheadMargin} 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore]);

  return sentinelRef;
}

function scrollContainerOf(element: Element): Element | null {
  for (let current = element.parentElement; current !== null; current = current.parentElement) {
    const { overflowY } = getComputedStyle(current);
    if (overflowY === "auto" || overflowY === "scroll") {
      return current;
    }
  }

  return null;
}
