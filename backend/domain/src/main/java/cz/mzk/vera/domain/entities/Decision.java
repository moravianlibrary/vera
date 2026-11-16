package cz.mzk.vera.domain.entities;

// STAT-axes: request decisions are values on a request.
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
