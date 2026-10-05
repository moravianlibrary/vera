// Proposals within the caller's proposal custody: the list a slice at a time, one proposal, the
// custodies' names, and the decisions. A decision changes what Documents, Proposals and the
// watchlist counts show, so it refetches all three.

import {
  keepPreviousData,
  skipToken,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Approval, Decline, ProposalGrouping, ProposalQuery } from "@/api/proposal-review";
import {
  approveProposal,
  bulkApproveProposals,
  declineProposal,
  findProposal,
  listProposalCustodies,
  listProposals,
  maximumProposalSliceSize,
} from "@/api/proposal-review";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";

export const proposalsQueryKey = ["proposals"] as const;

export function useProposalsQuery(query: ProposalQuery, grouping: ProposalGrouping | null) {
  return useInfiniteQuery({
    queryKey: [...proposalsQueryKey, "list", query, grouping],
    queryFn: ({ pageParam }) => listProposals(query, { grouping, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Keep the previous rows on screen while a new search is fetched.
    placeholderData: keepPreviousData,
  });
}

// Every open proposal a batch asked for, in one slice, for approving the batch at once.
// TODO(rrandiak): a batch beyond one slice (a harvest of thousands) needs the server to approve
// by batch rather than by listed documents.
export function useBatchProposalsQuery(batchId: string) {
  return useQuery({
    queryKey: [...proposalsQueryKey, "batch", batchId],
    queryFn: () => listProposals({ batchIds: [batchId] }, { limit: maximumProposalSliceSize }),
  });
}

export function useProposalQuery(documentId: string | null) {
  return useQuery({
    queryKey: [...proposalsQueryKey, "detail", documentId],
    queryFn: documentId === null ? skipToken : () => findProposal(documentId),
  });
}

export function useProposalCustodiesQuery() {
  return useQuery({
    queryKey: [...proposalsQueryKey, "custodies"],
    queryFn: listProposalCustodies,
    staleTime: Infinity,
  });
}

export function useDecisionMutations() {
  const queryClient = useQueryClient();
  // Not awaited: the caller's own callback runs first, while the decided proposal is still on
  // screen, and the refetch then takes it off.
  const onSuccess = () => {
    for (const queryKey of [proposalsQueryKey, documentsQueryKey, watchlistsQueryKey]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  return {
    approve: useMutation({
      mutationFn: ({ documentId, approval }: { documentId: string; approval: Approval }) =>
        approveProposal(documentId, approval),
      onSuccess,
    }),
    decline: useMutation({
      mutationFn: ({ documentId, decline }: { documentId: string; decline: Decline }) =>
        declineProposal(documentId, decline),
      onSuccess,
    }),
    bulkApprove: useMutation({ mutationFn: bulkApproveProposals, onSuccess }),
  };
}
