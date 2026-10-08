// Plugins' one index. What is changed there reaches the rest of VERA: an instance's name is
// reference data on Tasks and Schedules; switching one off or deleting it takes it out of
// Generate, the decide form's suggestion, Message…, the login page and custody placement, and
// deleting one removes its schedules; running one starts a run on Tasks. Delivery-channel
// changes also alter Hooks' available destinations. So a change asks again for every view
// that shows one.

import { skipToken, useQuery } from "@tanstack/react-query";
import { getInstanceUpgrade, getPluginImpact, getPluginIndex } from "@/api/plugins";
import { accessQueryKey } from "@/features/access/use-access-query";
import { listsQueryKey } from "@/features/lists/use-lists-query";
import { proposalsQueryKey } from "@/features/proposals/use-proposals-query";
import { schedulesQueryKey } from "@/features/tasks/use-tasks-query";
import { messagesQueryKey } from "@/hooks/use-message-query";
import { referenceQueryKey } from "@/hooks/use-reference-query";
import { tasksQueryKey } from "@/hooks/use-running-runs-query";

export const pluginsQueryKey = ["plugins"] as const;

export const pluginInvalidations = [
  pluginsQueryKey,
  ["hooks"],
  referenceQueryKey,
  tasksQueryKey,
  schedulesQueryKey,
  listsQueryKey,
  proposalsQueryKey,
  messagesQueryKey,
  accessQueryKey,
] as const;

export function usePluginsQuery() {
  return useQuery({ queryKey: pluginsQueryKey, queryFn: getPluginIndex });
}

// What switching an instance off would stop, asked while its dialog is open.
export function usePluginImpactQuery(instanceId: string, isEnabled: boolean) {
  return useQuery({
    queryKey: [...pluginsQueryKey, "impact", instanceId],
    queryFn: isEnabled ? () => getPluginImpact(instanceId) : skipToken,
  });
}

// What moving an instance to the newest version changes, asked while its dialog is open.
export function useInstanceUpgradeQuery(instanceId: string, isEnabled: boolean) {
  return useQuery({
    queryKey: [...pluginsQueryKey, "upgrade", instanceId],
    queryFn: isEnabled ? () => getInstanceUpgrade(instanceId) : skipToken,
  });
}
