package cz.mzk.vera.plugin.records;

import java.time.Instant;
import java.util.List;

// PLG-api-kinds: Registry; Property source; Validation; Restriction.
public record Document(String id, String catalogId, Unit unit, String title, String type, String shelfMark,
        List<PageSource> pageSources, List<RegistryRecord> registryRecords, List<PropertyValues> properties) {
    public Document(String id, String catalogId, Unit unit, String title, String type, String shelfMark) {
        this(id, catalogId, unit, title, type, shelfMark, List.of(), List.of(), List.of());
    }

    public record Unit(String type, String value) {}

    public record PageSource(String source, int tier, int value, Instant observedAt, String setBy) {}

    public record RegistryRecord(String registry, String state, String rawState, String linkKind, String url,
            Instant observedAt, Instant checkedAt, String error) {}

    public record PropertyValues(String key, List<SourcedValue> sources) {}

    public record SourcedValue(ValueSource source, int tier, Object value, Instant observedAt, String setBy) {}

    public record ValueSource(String kind, String instanceId, String instanceName) {}
}
