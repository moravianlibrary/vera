// The signed-in person's settings, fetched once per visit, and changes to them. A change writes
// the server's answer straight into the cache, so what was just remembered reads back at once.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserSettings, updateUserSettings } from "@/api/user-settings";

export const userSettingsQueryKey = ["user-settings"] as const;

export function useUserSettingsQuery() {
  return useQuery({
    queryKey: userSettingsQueryKey,
    queryFn: getUserSettings,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useUserSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateUserSettings,
    onSuccess: (settings) => queryClient.setQueryData(userSettingsQueryKey, settings),
  });
}
