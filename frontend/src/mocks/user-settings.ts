// The mock server's user settings. Unlike the rest of its state they survive a reload: what they
// emulate is a server that remembers a person's settings, so they are kept in this browser's
// storage. Where there is no storage they last as long as the page.

import type { UserSettings, UserSettingsChange } from "@vera/contract/user-settings";
import { settingsAfter, userSettingsSchema } from "@vera/contract/user-settings";
import { z } from "zod";

const storageKey = "vera.mock.user-settings";
const storedSchema = z.record(z.string(), userSettingsSchema);

const settingsByUser = new Map<string, UserSettings>(Object.entries(readStored()));

function readStored(): Record<string, UserSettings> {
  try {
    const stored = storedSchema.safeParse(
      JSON.parse(window.localStorage.getItem(storageKey) ?? "{}"),
    );
    return stored.success ? stored.data : {};
  } catch {
    return {};
  }
}

function store(): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(settingsByUser)));
  } catch {
    // Storage is blocked: the settings last as long as the page.
  }
}

export function userSettingsOf(userId: string): UserSettings {
  return settingsByUser.get(userId) ?? { lastOpenedWatchlists: {} };
}

export function changeUserSettings(userId: string, change: UserSettingsChange): UserSettings {
  const current = userSettingsOf(userId);
  const changed = settingsAfter(current, change);
  settingsByUser.set(userId, changed);
  store();
  return changed;
}
