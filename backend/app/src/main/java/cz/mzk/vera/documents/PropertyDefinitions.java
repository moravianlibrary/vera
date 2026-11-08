package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.PROPERTY_DEFINITIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Component;

// DOC-property-filter; DOC-property-visibility: read each definition and its typed values once.
@Component
public final class PropertyDefinitions implements PropertyDefinitionCatalog {
    public record Definition(String key, PropertyType type, PropertyAbout about,
            PropertyVisibility visibility, List<String> values) {
        public Definition {
            values = List.copyOf(values);
        }
    }

    private final DocumentJson json;

    PropertyDefinitions(DocumentJson json) {
        this.json = json;
    }

    public List<Definition> all(DSLContext dsl) {
        return dsl.selectFrom(PROPERTY_DEFINITIONS).orderBy(PROPERTY_DEFINITIONS.POSITION)
            .fetch(row -> definition(row.getKey(), row.getType(), row.getAbout(), row.getVisibility()));
    }

    public List<Definition> filterable(DSLContext dsl, Audience audience) {
        return all(dsl).stream()
            .filter(definition -> !definition.key().equals(PropertyKey.PAGE_COUNT.wireName()))
            .filter(definition -> audience != Audience.PUBLIC
                || definition.visibility() == PropertyVisibility.PUBLIC)
            .toList();
    }

    public List<String> publicKeys(DSLContext dsl) {
        return all(dsl).stream()
            .filter(definition -> definition.visibility() == PropertyVisibility.PUBLIC)
            .map(Definition::key)
            .toList();
    }

    @Override
    public Set<String> catalogPropertyKeys(DSLContext dsl) {
        Set<String> keys = new HashSet<>();
        dsl.select(PLUGIN_IMPLEMENTATIONS.VERSIONS)
                .from(PLUGIN_IMPLEMENTATIONS)
                .where(PLUGIN_IMPLEMENTATIONS.KIND.eq("CatalogAdapter"))
                .fetch().forEach(row -> json.read(row.value1()).forEach(version ->
                        version.path("declares").path("properties").forEach(property ->
                                keys.add(property.path("key").asString()))));
        return Set.copyOf(keys);
    }

    private Definition definition(String key, JSONB typeValue, String aboutValue,
            String visibilityValue) {
        var typeJson = json.read(typeValue);
        PropertyType type = PropertyType.fromWireName(typeJson.path("kind").asString());
        List<String> values = new ArrayList<>();
        if (type == PropertyType.ENUM) {
            typeJson.path("values").forEach(value -> values.add(value.path("value").asString()));
        } else if (type == PropertyType.YES_NO) {
            values.add("Yes");
            values.add("No");
        }
        return new Definition(key, type, PropertyAbout.fromWireName(aboutValue),
            PropertyVisibility.fromWireName(visibilityValue), values);
    }
}
