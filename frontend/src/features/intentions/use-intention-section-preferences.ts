import { useState } from "react";

export const intentionSectionIds = ["repeats", "running", "upcoming", "ended", "archived"] as const;
export type IntentionSectionId = (typeof intentionSectionIds)[number];
type Preferences = Partial<Record<IntentionSectionId, boolean>>;
const storageKeyOf = (userId: string) => `vera.intentions.sections.${userId}`;

function readPreferences(userId: string): Preferences {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(storageKeyOf(userId)) ?? "null");
    if (stored === null || typeof stored !== "object" || Array.isArray(stored)) return {};
    const values = stored as Record<string, unknown>;
    return Object.fromEntries(
      intentionSectionIds.flatMap((id) =>
        typeof values[id] === "boolean" ? [[id, values[id]]] : [],
      ),
    );
  } catch {
    return {};
  }
}

export function useIntentionSectionPreferences(userId: string) {
  const [preferences, setPreferences] = useState(() => readPreferences(userId));
  const isOpen = (id: IntentionSectionId) => preferences[id] ?? true;
  const setOpen = (id: IntentionSectionId, open: boolean) => {
    const next = { ...preferences, [id]: open };
    setPreferences(next);
    try {
      window.localStorage.setItem(storageKeyOf(userId), JSON.stringify(next));
    } catch {
      /* Browser storage may be unavailable. */
    }
  };
  return { isOpen, setOpen };
}
