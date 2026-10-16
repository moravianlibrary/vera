// The signed-in person's settings, kept by the server so they follow the person between devices
// (navigation.md §7, Preferences). So far only what the client remembers for them: the tab each
// view was last left on (filtering.md §4.2), and what the Categories tree shows on each row.

import { z } from "zod";
import { getJson, patchJson } from "@/api/http";
import { apiRoutes } from "@/api/routes";
import { categoryTreeValues } from "@/domain/categories";
import { watchlistViewSchema } from "@/domain/entities";

export const userSettingsSchema = z.object({
  // Per view, the watchlist last opened there, null for "All". A view never opened is absent.
  lastOpenedWatchlists: z.partialRecord(watchlistViewSchema, z.string().nullable()),
  // Absent until picked once.
  categoryTreeValue: z.enum(categoryTreeValues).optional(),
  appearance: z.enum(["system", "light", "dark"]).optional(),
  dateFormat: z.enum(["local", "iso"]).optional(),
  density: z.enum(["comfortable", "compact"]).optional(),
  // A missing entry follows the most recently opened tab. Null fixes the view to All.
  fixedOpeningWatchlists: z.partialRecord(watchlistViewSchema, z.string().nullable()).optional(),
  notifications: z
    .object({
      doNotSend: z.boolean(),
      // Keyed by stable Hook ID. Missing follows that Hook's explicit default.
      hooks: z.record(z.string(), z.boolean()),
      // WATCH-channel-off: the watchlist channels switched off for every watchlist, by instance
      // id, browser push as `push`.
      channelsOff: z.array(z.string()).optional(),
      // WATCH-channel-off: every hook's email, since hooks reach people by email only.
      noHookEmail: z.boolean().optional(),
    })
    .optional(),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

// A change names only what it changes: each view it names replaces that view's entry.
export const userSettingsChangeSchema = userSettingsSchema.partial();
export type UserSettingsChange = z.infer<typeof userSettingsChangeSchema>;

export async function getUserSettings(): Promise<UserSettings> {
  return getJson(apiRoutes.userSettings, userSettingsSchema);
}

export async function updateUserSettings(change: UserSettingsChange): Promise<UserSettings> {
  return patchJson(apiRoutes.userSettings, change, userSettingsSchema);
}
