// The display tier the window is in (view-rules.md §1; component-interfaces.md §0.1). A tier is
// a display, not a breakpoint: it decides the navigation, whether a pane docks, the dialog form,
// the action cap and the filter depth. What the room decides (list columns, fact columns) is a
// container query instead (§0.2).

import { useMediaQuery } from "@/hooks/use-media-query";

export const tiers = ["phone", "small", "notebook", "large"] as const;
export type Tier = (typeof tiers)[number];

// Where each tier starts, in CSS pixels; phone is everything below small.
export const tierStarts = { small: 768, notebook: 1280, large: 1600 } as const;

export function useTier(): Tier {
  const isSmall = useMediaQuery(`(min-width: ${tierStarts.small}px)`);
  const isNotebook = useMediaQuery(`(min-width: ${tierStarts.notebook}px)`);
  const isLarge = useMediaQuery(`(min-width: ${tierStarts.large}px)`);
  return tierOf({ isSmall, isNotebook, isLarge });
}

export function tierOf(matches: { isSmall: boolean; isNotebook: boolean; isLarge: boolean }): Tier {
  if (matches.isLarge) {
    return "large";
  }

  if (matches.isNotebook) {
    return "notebook";
  }

  return matches.isSmall ? "small" : "phone";
}

// A value that differs per tier. Notebook is required, since every page is designed there first;
// a missing tier takes its nearest neighbour's value towards notebook.
export type PerTier<Value> = { notebook: Value } & Partial<
  Record<Exclude<Tier, "notebook">, Value>
>;

export function valueForTier<Value>(values: PerTier<Value>, tier: Tier): Value {
  switch (tier) {
    case "large":
      return values.large ?? values.notebook;
    case "notebook":
      return values.notebook;
    case "small":
      return values.small ?? values.notebook;
    case "phone":
      return values.phone ?? values.small ?? values.notebook;
  }
}
