package cz.mzk.vera.plugin.input;

import cz.mzk.vera.plugin.PluginContext;
import java.util.Map;

// PLG-api-kinds: Input.
public interface EntryLinkInput {
    EntryAnswer entry(PluginContext context, EntryInput input);

    record EntryInput(Map<String, String> parameters, String page) {}
    record EntryAnswer(Item item, String origin) {}
    sealed interface Item permits CatalogId, Identifier, Unit, Reason {}
    record CatalogId(String catalogId) implements Item {}
    record Identifier(String type, String value) implements Item {}
    record Unit(String value) implements Item {}
    record Reason(String value) implements Item {}
}
