package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.PROPERTY_DEFINITIONS;

import java.util.ArrayList;
import java.util.List;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Component;

// DOC-property-filter; DOC-property-visibility: read each definition and its typed values once.
@Component
final class PropertyDefinitions {
    record Definition(String key, PropertyType type, PropertyAbout about,
            PropertyVisibility visibility, List<String> values) {
        Definition {
            values = List.copyOf(values);
        }
    }

    private final DocumentJson json;

    PropertyDefinitions(DocumentJson json) {
        this.json = json;
    }

    List<Definition> all(DSLContext dsl) {
        return dsl.selectFrom(PROPERTY_DEFINITIONS).orderBy(PROPERTY_DEFINITIONS.POSITION)
            .fetch(row -> definition(row.getKey(), row.getType(), row.getAbout(), row.getVisibility()));
    }

    List<Definition> filterable(DSLContext dsl, Audience audience) {
        return all(dsl).stream()
            .filter(definition -> !definition.key().equals(PropertyKey.PAGE_COUNT.wireName()))
            .filter(definition -> audience != Audience.PUBLIC
                || definition.visibility() == PropertyVisibility.PUBLIC)
            .toList();
    }

    List<String> publicKeys(DSLContext dsl) {
        return all(dsl).stream()
            .filter(definition -> definition.visibility() == PropertyVisibility.PUBLIC)
            .map(Definition::key)
            .toList();
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
