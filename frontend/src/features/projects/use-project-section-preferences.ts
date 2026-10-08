// The Projects board's open sections are a per-person, per-browser choice. They all begin open;
// only an explicit toggle is stored. A filtered view with one section ignores the stored choice
// while it is alone, then restores the choice when the other sections return.

import { useState } from "react";

export const projectSectionIds = ["proposed", "active", "ended", "rejected"] as const;
export type ProjectSectionId = (typeof projectSectionIds)[number];
type Preferences = Partial<Record<ProjectSectionId, boolean>>;

const storageKeyOf = (userId: string) => `vera.projects.sections.${userId}`;

function readPreferences(userId: string): Preferences {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(storageKeyOf(userId)) ?? "null");
    if (stored === null || typeof stored !== "object" || Array.isArray(stored)) {
      return {};
    }

    const values = stored as Record<string, unknown>;
    return Object.fromEntries(
      projectSectionIds.flatMap((id) =>
        typeof values[id] === "boolean" ? [[id, values[id]]] : [],
      ),
    );
  } catch {
    return {};
  }
}

function storePreferences(userId: string, preferences: Preferences): void {
  try {
    window.localStorage.setItem(storageKeyOf(userId), JSON.stringify(preferences));
  } catch {
    // If storage is blocked, the choice lasts for this mounted page.
  }
}

export function useProjectSectionPreferences(userId: string) {
  const [preferences, setPreferences] = useState(() => readPreferences(userId));

  const isOpen = (id: ProjectSectionId) => preferences[id] ?? true;
  const setOpen = (id: ProjectSectionId, open: boolean) => {
    const next = { ...preferences, [id]: open };
    setPreferences(next);
    storePreferences(userId, next);
  };

  return { isOpen, setOpen };
}
