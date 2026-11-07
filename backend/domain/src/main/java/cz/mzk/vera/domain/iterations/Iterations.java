package cz.mzk.vera.domain.iterations;

import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.PublicationLink;

// DOC-publication-link: return the marked primary link.
public final class Iterations {
  private Iterations() {
  }

  public static PublicationLink primaryLinkOf(Iteration iteration) {
    return iteration.links().stream().filter(PublicationLink::isPrimary).findFirst().orElse(null);
  }
}
