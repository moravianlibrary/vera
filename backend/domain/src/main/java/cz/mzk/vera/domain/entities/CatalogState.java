package cz.mzk.vera.domain.entities;

// DOC-relink: the catalog record may be gone or replaced by another record.
public record CatalogState(String kind, String catalogId, String documentId) {}
