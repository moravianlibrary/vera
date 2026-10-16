// Calls the user-settings endpoints; what they take and answer is in @vera/contract/user-settings.

import { apiRoutes } from "@vera/contract/routes";
import type { UserSettings, UserSettingsChange } from "@vera/contract/user-settings";
import { userSettingsSchema } from "@vera/contract/user-settings";
import { getJson, patchJson } from "@/api/http";

export async function getUserSettings(): Promise<UserSettings> {
  return getJson(apiRoutes.userSettings, userSettingsSchema);
}

export async function updateUserSettings(change: UserSettingsChange): Promise<UserSettings> {
  return patchJson(apiRoutes.userSettings, change, userSettingsSchema);
}
