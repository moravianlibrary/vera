// The signed-in session, shared by the shell and every view that checks a grant.

import { useQuery } from "@tanstack/react-query";
import { getSession } from "@/api/session";
import { ApiError } from "@/api/http";

export const sessionQueryKey = ["session"] as const;

export function useSessionQuery() {
  return useQuery({ queryKey: sessionQueryKey, queryFn: getSession, staleTime: Infinity,
    retry: (count, error) => !(error instanceof ApiError && error.status === 401) && count < 2 });
}
