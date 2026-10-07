// Users & Groups' one index. What is changed there reaches further: a role or a hand-set one
// changes what the people holding it may do, the caller included, so the session is asked again;
// a group or a custody changes the names and counts other views show, and which proposals each
// decider sees.

import { skipToken, useQuery } from "@tanstack/react-query";
import { getAccessIndex, getCustodyImpact, getRoleImpact } from "@/api/access";
import { categoriesQueryKey } from "@/features/categories/use-categories-query";
import { proposalsQueryKey } from "@/features/proposals/use-proposals-query";
import { referenceQueryKey } from "@/hooks/use-reference-query";
import { sessionQueryKey } from "@/hooks/use-session-query";

export const accessQueryKey = ["access"] as const;

export const accessInvalidations = [
  accessQueryKey,
  sessionQueryKey,
  referenceQueryKey,
  proposalsQueryKey,
  categoriesQueryKey,
] as const;

export function useAccessQuery() {
  return useQuery({ queryKey: accessQueryKey, queryFn: getAccessIndex });
}

// What deleting a role or a custody would do, asked while its dialog is open.
export function useRoleImpactQuery(roleId: string, isEnabled: boolean) {
  return useQuery({
    queryKey: [...accessQueryKey, "impact", "role", roleId],
    queryFn: isEnabled ? () => getRoleImpact(roleId) : skipToken,
  });
}

export function useCustodyImpactQuery(custodyId: string, isEnabled: boolean) {
  return useQuery({
    queryKey: [...accessQueryKey, "impact", "custody", custodyId],
    queryFn: isEnabled ? () => getCustodyImpact(custodyId) : skipToken,
  });
}
