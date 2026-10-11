// Whether the docked sidebar is expanded or collapsed to the rail. The choice is remembered per
// device and per size tier (navigation.md §4.3): one person wants a different answer on a large
// monitor and on a notebook, so a tier never inherits the other's choice. Without a stored
// choice, large is expanded and notebook collapsed.

import { useEffect, useState } from "react";
import { useTier } from "@/hooks/use-tier";

type SidebarTier = "large" | "notebook";

const expandedValue = "1";
const collapsedValue = "0";
const changedEvent = "vera:sidebar-preference";

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
  useEffect(() => {
    const refresh = () =>
      setPreferences({
        large: readStoredPreference("large"),
        notebook: readStoredPreference("notebook"),
      });
    window.addEventListener(changedEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(changedEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const isExpanded = preferences[tier] ?? tier === "large";

  const toggle = () => {
    const next = !isExpanded;
    storePreference(tier, next);
    setPreferences((current) => ({ ...current, [tier]: next }));
    window.dispatchEvent(new Event(changedEvent));
  };

  const setForTier = (target: SidebarTier, expanded: boolean) => {
    storePreference(target, expanded);
    setPreferences((current) => ({ ...current, [target]: expanded }));
    window.dispatchEvent(new Event(changedEvent));
  };

  return { isExpanded, toggle, setForTier, preferences };
}
