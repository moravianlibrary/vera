package cz.mzk.vera.plugin.catalog;

// PLG-api-record-change: one catalog record replaced another.
public record CatalogReplacement(String oldCatalogId, String newCatalogId) {}
