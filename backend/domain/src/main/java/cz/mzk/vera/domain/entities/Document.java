package cz.mzk.vera.domain.entities;

import java.util.List;

// B3 domain entity fields consumed by the Java rule ports.
public record Document(String id, String catalogId, String unitValue, List<PageSource> pageSources,
    List<RegistryRecord> registryRecords) {}
