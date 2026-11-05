package cz.mzk.vera.domain.entities;

// STAT-status-model: request decisions are values on a request.
public enum Decision {
  Pending,
  Approved,
  Denied,
  Withdrawn,
  Duplicate;

  public String wireName() {
    return name();
  }
}
