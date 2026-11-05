package cz.mzk.vera.domain.entities;

// STAT-status-model: progress values follow the shared status vocabulary.
public enum Progress {
  Enqueued,
  IngestFailed,
  Ready,
  Planned,
  InProgress,
  Digitized,
  Published;

  public String wireName() {
    return name();
  }
}
