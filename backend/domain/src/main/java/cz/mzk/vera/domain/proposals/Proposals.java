package cz.mzk.vera.domain.proposals;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

// ENT-batch: name an unnamed batch with the library's local submission time.
public final class Proposals {
  private static final DateTimeFormatter BATCH_NAME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
      .withZone(ZoneId.of("Europe/Prague"));

  private Proposals() {
  }

  public static String defaultBatchNameOf(Instant at) {
    return BATCH_NAME.format(at);
  }
}
