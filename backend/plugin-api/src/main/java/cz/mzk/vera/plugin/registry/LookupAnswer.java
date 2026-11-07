package cz.mzk.vera.plugin.registry;

import java.util.List;

// PLG-api-kinds: Registry.
public record LookupAnswer(List<RegistryRecord> records) {
    public record RegistryRecord(String rawState, String link) {}
}
