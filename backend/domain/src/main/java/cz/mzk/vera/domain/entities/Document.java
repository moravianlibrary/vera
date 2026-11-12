package cz.mzk.vera.domain.entities;

import java.util.List;

// B3 domain entity fields consumed by the Java rule ports.
public record Document(String id, String catalogId, String unitValue, List<PageSource> pageSources,
    List<RegistryRecord> registryRecords, CatalogState catalogState) {
  public Document(String id, String catalogId, String unitValue, List<PageSource> pageSources,
      List<RegistryRecord> registryRecords) {
    this(id, catalogId, unitValue, pageSources, registryRecords, null);
  }
}
