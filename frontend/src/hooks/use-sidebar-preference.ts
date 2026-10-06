// Whether the docked sidebar is expanded or collapsed to the rail. The choice is remembered per
// device and per size tier (navigation.md §4.3): one person wants a different answer on a large
// monitor and on a notebook, so a tier never inherits the other's choice. Without a stored
// choice, large is expanded and notebook collapsed.

import { useState } from "react";
import { useTier } from "@/hooks/use-tier";

type SidebarTier = "large" | "notebook";

const expandedValue = "1";
const collapsedValue = "0";

function storageKeyOf(tier: SidebarTier): string {
  return `vera.sidebar.${tier}`;
}

// Null when nothing is stored or storage is unavailable.
function readStoredPreference(tier: SidebarTier): boolean | null {
  try {
    const value = window.localStorage.getItem(storageKeyOf(tier));
    return value === null ? null : value === expandedValue;
  } catch {
    return null;
  }
}

function storePreference(tier: SidebarTier, isExpanded: boolean): void {
  try {
    window.localStorage.setItem(storageKeyOf(tier), isExpanded ? expandedValue : collapsedValue);
  } catch {
    // Storage is blocked: the choice lasts until the page reloads.
  }
}

export function useSidebarPreference() {
  const tier: SidebarTier = useTier() === "large" ? "large" : "notebook";
  const [preferences, setPreferences] = useState(() => ({
    large: readStoredPreference("large"),
    notebook: readStoredPreference("notebook"),
  }));

  const isExpanded = preferences[tier] ?? tier === "large";

  const toggle = () => {
    const next = !isExpanded;
    storePreference(tier, next);
    setPreferences((current) => ({ ...current, [tier]: next }));
  };

  return { isExpanded, toggle };
}
