// Proposals within the caller's proposal custody: the list a slice at a time, one proposal and
// the decisions. A decision changes what Documents, Proposals and the watchlist counts show, so
// it refetches all three.

import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Approval, ProposalGrouping, ProposalQuery } from "@/api/proposal-review";
import { approveProposal, findProposal, listProposals } from "@/api/proposal-review";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { usePagedList } from "@/hooks/use-paged-list";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";

export const proposalsQueryKey = ["proposals"] as const;

export function useProposalsQuery(query: ProposalQuery, grouping: ProposalGrouping | null) {
  return usePagedList([...proposalsQueryKey, "list", query, grouping], (cursor) =>
    listProposals(query, { grouping, cursor }),
  );
}

// Every open proposal a batch asked for, wherever its earliest ask was, a slice at a time: the
// bulk approve lists them to be unticked, and the server takes the batch whole.
export function useBatchProposalsQuery(batchId: string) {
  const query: ProposalQuery = { batchIds: [batchId], decisions: ["Pending"] };
  return usePagedList([...proposalsQueryKey, "batch", batchId], (cursor) =>
    listProposals(query, { cursor }),
  );
}

export function useProposalQuery(documentId: string | null) {
  return useQuery({
    queryKey: [...proposalsQueryKey, "detail", documentId],
    queryFn: documentId === null ? skipToken : () => findProposal(documentId),
  });
}

// What a decision changes.
export const decisionInvalidations = [proposalsQueryKey, documentsQueryKey, watchlistsQueryKey];

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
