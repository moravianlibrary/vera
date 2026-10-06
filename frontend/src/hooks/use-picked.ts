// Several records picked at once, for a bulk act (component-interfaces.md §9.4). One open record
// lives in the URL; several live in memory and are forgotten when what the list shows changes
// (`resetKey`), so a pick never covers rows nobody can see. A range extends from the last pick.

import { useState } from "react";

export interface Picked {
  ids: ReadonlySet<string>;
  toggle: (id: string, extendRange?: boolean) => void;
  // A group's or a pane's "select all".
  setMany: (ids: readonly string[], isPicked: boolean) => void;
  clear: () => void;
}

interface PickState {
  resetKey: string;
  ids: ReadonlySet<string>;
  anchorId: string | null;
}

export function usePicked(orderedIds: readonly string[], resetKey: unknown): Picked {
  const key = JSON.stringify(resetKey);
  const [state, setState] = useState<PickState>({ resetKey: key, ids: new Set(), anchorId: null });
  // A new key forgets the picks during render, so no frame shows the stale ones.
  const current =
    state.resetKey === key ? state : { resetKey: key, ids: new Set<string>(), anchorId: null };
  if (current !== state) {
    setState(current);
  }

  const toggle = (id: string, extendRange = false) => {
    const anchorIndex = current.anchorId === null ? -1 : orderedIds.indexOf(current.anchorId);
    const index = orderedIds.indexOf(id);
    const next = new Set(current.ids);
    if (extendRange && anchorIndex >= 0 && index >= 0) {
      const [from, to] = anchorIndex < index ? [anchorIndex, index] : [index, anchorIndex];
      for (const rangeId of orderedIds.slice(from, to + 1)) {
        next.add(rangeId);
      }
    } else if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    setState({ resetKey: key, ids: next, anchorId: id });
  };

  const setMany = (ids: readonly string[], isPicked: boolean) => {
    const next = new Set(current.ids);
    for (const id of ids) {
      if (isPicked) {
        next.add(id);
      } else {
        next.delete(id);
      }
    }

    setState({ ...current, ids: next });
  };

  return {
    ids: current.ids,
    toggle,
    setMany,
    clear: () => setState({ resetKey: key, ids: new Set(), anchorId: null }),
  };
}
