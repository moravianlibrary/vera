package cz.mzk.vera.domain.entities;

// DOC-registry-status: registry evidence follows the shared order.
public enum RegistryState {
  CheckFailed,
  NotFound,
  Unmapped,
  Planned,
  InProgress,
  Digitized,
  Published;

  public String wireName() {
    return name();
  }
}
