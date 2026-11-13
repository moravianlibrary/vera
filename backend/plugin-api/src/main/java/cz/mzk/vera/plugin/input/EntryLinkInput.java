package cz.mzk.vera.plugin.input;

import cz.mzk.vera.plugin.PluginContext;
import java.util.Map;

// PLG-api-kinds: Input.
public interface EntryLinkInput {
    EntryAnswer entry(PluginContext context, EntryInput input);

    record EntryInput(Map<String, String> parameters, String page) {}
    record EntryAnswer(Item item, String unit, String reason, String origin) {}
    sealed interface Item permits CatalogId, Identifier {}
    record CatalogId(String catalogId) implements Item {}
    record Identifier(String type, String value) implements Item {}
}
