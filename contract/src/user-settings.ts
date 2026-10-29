// The signed-in person's settings, kept by the server so they follow the person between devices
// (navigation.md §7, Preferences). So far only what the client remembers for them: the tab each
// view was last left on (filtering.md §4.2), and what the Categories tree shows on each row.

import { categoryTreeValues } from "@vera/domain/categories";
import { watchlistViewSchema } from "@vera/domain/entities";
import { z } from "zod";

// UI-language: the languages the interface speaks.
export const languages = ["cs", "en"] as const;

export type Language = (typeof languages)[number];

export const userSettingsSchema = z.object({
  // Per view, the watchlist last opened there, null for "All". A view never opened is absent.
  lastOpenedWatchlists: z.partialRecord(watchlistViewSchema, z.string().nullable()),
  // Absent until picked once.
  categoryTreeValue: z.enum(categoryTreeValues).optional(),
  appearance: z.enum(["system", "light", "dark"]).optional(),
  // UI-language: absent until the first login saves the one in use.
  language: z.enum(languages).optional(),
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

export function settingsAfter(current: UserSettings, change: UserSettingsChange): UserSettings {
  return {
    ...current,
    ...change,
    lastOpenedWatchlists: { ...current.lastOpenedWatchlists, ...change.lastOpenedWatchlists },
    ...(change.fixedOpeningWatchlists === undefined
      ? {}
      : {
          fixedOpeningWatchlists: {
            ...current.fixedOpeningWatchlists,
            ...change.fixedOpeningWatchlists,
          },
        }),
    ...(change.notifications === undefined
      ? {}
      : {
          notifications: {
            doNotSend: change.notifications.doNotSend ?? current.notifications?.doNotSend ?? false,
            hooks: { ...current.notifications?.hooks, ...change.notifications.hooks },
            channelsOff: change.notifications.channelsOff ?? current.notifications?.channelsOff,
            noHookEmail: change.notifications.noHookEmail ?? current.notifications?.noHookEmail,
          },
        }),
  };
}
