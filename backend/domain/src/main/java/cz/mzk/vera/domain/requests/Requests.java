package cz.mzk.vera.domain.requests;

import cz.mzk.vera.domain.documents.Documents;
import cz.mzk.vera.domain.entities.Decision;
import cz.mzk.vera.domain.entities.Request;
import cz.mzk.vera.domain.requests.RequestRow;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

// VIEW-requests, status-model §2.7, plugins.md §4.13, concepts.md Category.
public final class Requests {
  private Requests() {
  }

  public static ProposalDecision rowDecisionOf(List<Request> requests) {
    for (ProposalDecision decision : ProposalDecision.values()) {
      if (requests.stream().anyMatch(request -> proposalDecisionOf(request.decision()) == decision)) {
        return decision;
      }
    }
    return null;
  }

  public static boolean isProposalDecision(Decision decision) {
    return proposalDecisionOf(decision) != null;
  }

  public static boolean isBeingChecked(RequestRow row) {
    return row.decision() == ProposalDecision.Pending
        && asksOf(row).stream().anyMatch(request -> request.checkedAt() == null);
  }

  public static boolean isRescan(RequestRow row) {
    return !Documents.existingCopiesOf(asksOf(row)).isEmpty();
  }

  public static boolean isBulkApprovable(RequestRow row) {
    return row.decision() == ProposalDecision.Pending && !isRescan(row) && !isBeingChecked(row);
  }

  public static List<Request> asksOf(RequestRow row) {
    return row.record().requests();
  }

  public static List<String> askerIdsOf(RequestRow row) {
    Set<String> ids = new LinkedHashSet<>();
    asksOf(row).forEach(request -> ids.add(request.requesterId()));
    return List.copyOf(ids);
  }

  public static Request firstAskOf(RequestRow row) {
    return asksOf(row).isEmpty() ? null : asksOf(row).getFirst();
  }

  public static boolean isAfterProjectApproval(RequestRow row) {
    return asksOf(row).stream().anyMatch(
        request -> request.decision() == Decision.Pending && request.isAfterProjectApproval());
  }

  public static List<String> projectIdsOf(RequestRow row) {
    Set<String> ids = new LinkedHashSet<>();
    asksOf(row).stream().map(Request::projectId).filter(value -> value != null).forEach(ids::add);
    return List.copyOf(ids);
  }

  public static List<String> batchIdsOf(RequestRow row) {
    Set<String> ids = new LinkedHashSet<>();
    asksOf(row).stream().map(Request::batchId).forEach(ids::add);
    return List.copyOf(ids);
  }

  public static List<String> reasonsOf(RequestRow row) {
    Set<String> reasons = new LinkedHashSet<>();
    asksOf(row).stream().map(Request::reason).filter(value -> value != null).forEach(reasons::add);
    return List.copyOf(reasons);
  }

  private static ProposalDecision proposalDecisionOf(Decision decision) {
    return switch (decision) {
      case Pending -> ProposalDecision.Pending;
      case Denied -> ProposalDecision.Denied;
      case Withdrawn -> ProposalDecision.Withdrawn;
      case Approved, Duplicate -> null;
    };
  }
}
