// Requests within the reach of the caller's `request.read`: the list a slice at a time, one proposal and
// the decisions. A decision changes what Documents, Requests and the watchlist counts show, so
// it refetches all three.

import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Approval, RequestGrouping, RequestQuery } from "@vera/contract/requests";
import { approveProposal, findRequest, listRequests } from "@/api/requests";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { usePagedList } from "@/hooks/use-paged-list";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";

export const requestsQueryKey = ["requests"] as const;

export function useRequestsQuery(query: RequestQuery, grouping: RequestGrouping | null) {
  return usePagedList([...requestsQueryKey, "list", query, grouping], (cursor) =>
    listRequests(query, { grouping, cursor }),
  );
}

// Every open proposal a batch asked for, wherever its earliest ask was, a slice at a time: the
// bulk approve lists them to be unticked, and the server takes the batch whole.
export function useBatchProposalsQuery(batchId: string) {
  const query: RequestQuery = { batchIds: [batchId], decisions: ["Pending"] };
  return usePagedList([...requestsQueryKey, "batch", batchId], (cursor) =>
    listRequests(query, { cursor }),
  );
}

export function useRequestQuery(documentId: string | null) {
  return useQuery({
    queryKey: [...requestsQueryKey, "detail", documentId],
    queryFn: documentId === null ? skipToken : () => findRequest(documentId),
  });
}

// What a decision changes.
export const decisionInvalidations = [requestsQueryKey, documentsQueryKey, watchlistsQueryKey];

export function useDecisionMutations() {
  const queryClient = useQueryClient();
  // Not awaited: the caller's own callback runs first, while the decided proposal is still on
  // screen, and the refetch then takes it off.
  const onSuccess = () => {
    for (const queryKey of decisionInvalidations) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  return {
    approve: useMutation({
      mutationFn: ({ documentId, approval }: { documentId: string; approval: Approval }) =>
        approveProposal(documentId, approval),
      onSuccess,
    }),
  };
}
