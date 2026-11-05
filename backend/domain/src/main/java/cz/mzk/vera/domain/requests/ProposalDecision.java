package cz.mzk.vera.domain.requests;

// VIEW-requests: proposal decisions are ordered by the list rule.
public enum ProposalDecision {
  Pending,
  Denied,
  Withdrawn;

  public String wireName() {
    return name();
  }
}
