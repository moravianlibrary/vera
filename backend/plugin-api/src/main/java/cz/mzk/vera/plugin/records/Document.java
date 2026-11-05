package cz.mzk.vera.plugin.records;

// PLG-api-kinds: Custody; Classifier. Page sources, registry records, properties and existing copies
// come in a minor version when a plugin needs one (PLG-api-version).
public record Document(String id, String catalogId, Unit unit, String title, String type, String shelfMark) {
    public record Unit(String type, String value) {}
}
