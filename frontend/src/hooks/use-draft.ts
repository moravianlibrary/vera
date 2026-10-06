// An edit kept apart from what was saved until Save (component-interfaces.md §9.5): what it
// started from, what it holds now, and whether the two differ. Nothing reaches the server, or
// anybody else's view, before then.

import { useState } from "react";

export interface Draft<Value> {
  original: Value;
  current: Value;
  set: (next: Value) => void;
  isDirty: boolean;
  reset: () => void;
  // After a save: what is held now becomes what was saved.
  commit: () => void;
}

export function useDraft<Value>(
  initial: Value,
  isEqual: (first: Value, second: Value) => boolean = Object.is,
): Draft<Value> {
  const [original, setOriginal] = useState(initial);
  const [current, setCurrent] = useState(initial);

  return {
    original,
    current,
    set: setCurrent,
    isDirty: !isEqual(original, current),
    reset: () => setCurrent(original),
    commit: () => setOriginal(current),
  };
}

export function isSameSet(first: ReadonlySet<string>, second: ReadonlySet<string>): boolean {
  return first.size === second.size && [...first].every((value) => second.has(value));
}
