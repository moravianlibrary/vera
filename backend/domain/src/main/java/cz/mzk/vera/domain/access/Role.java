package cz.mzk.vera.domain.access;

import java.util.List;

public record Role(String id, List<Grant> grants) {
  public Role {
    grants = List.copyOf(grants);
  }
}
