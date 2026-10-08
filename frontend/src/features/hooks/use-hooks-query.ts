// Hooks' one index; writes also update linked hooks on Plugin channels.

import { useQuery } from "@tanstack/react-query";
import { getHookIndex } from "@/api/hooks";
import { pluginsQueryKey } from "@/features/plugins/use-plugins-query";

export const hooksQueryKey = ["hooks"] as const;
export const hookInvalidations = [hooksQueryKey, pluginsQueryKey] as const;

export function useHooksQuery() {
  return useQuery({ queryKey: hooksQueryKey, queryFn: getHookIndex, refetchInterval: 30_000 });
}
