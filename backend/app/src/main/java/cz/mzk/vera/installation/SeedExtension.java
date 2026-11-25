package cz.mzk.vera.installation;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.BinaryOperator;
import java.util.function.Function;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

// A child seed over its parent; the same semantics as contract/src/seed-extends.ts. Collection rows
// append or replace by id, keyed collections and fakes merge by key, and shipped plugins merge by
// package, their instances by id, so an installation seed adds instances to the one it extends.
public final class SeedExtension {
    private static final JsonNodeFactory NODES = JsonNodeFactory.instance;

    private SeedExtension() {
    }

    public static JsonNode extend(JsonNode parent, JsonNode child) {
        ObjectNode base = (ObjectNode) parent.deepCopy();
        base.remove("extends");
        ObjectNode own = (ObjectNode) child.deepCopy();
        own.remove("extends");
        ObjectNode merged = base.deepCopy();
        own.properties().forEach(entry -> {
            String key = entry.getKey();
            if (key.equals("collections") && entry.getValue().isObject()) {
                merged.set(key, mergeCollections(base.get(key), entry.getValue()));
            } else if (key.equals("fakes") && entry.getValue().isObject()) {
                merged.set(key, mergeObjects(base.get(key), entry.getValue()));
            } else if (key.equals("shippedPlugins") && entry.getValue().isArray() && base.path(key).isArray()) {
                merged.set(key, mergeShippedPlugins(base.get(key), entry.getValue()));
            } else {
                merged.set(key, entry.getValue());
            }
        });
        return merged;
    }

    private static ObjectNode mergeCollections(JsonNode parent, JsonNode child) {
        ObjectNode out = parent != null && parent.isObject() ? (ObjectNode) parent.deepCopy() : NODES.objectNode();
        child.properties().forEach(entry -> out.set(entry.getKey(), out.has(entry.getKey())
                ? mergeValue(out.get(entry.getKey()), entry.getValue())
                : entry.getValue()));
        return out;
    }

    private static ObjectNode mergeObjects(JsonNode parent, JsonNode child) {
        ObjectNode out = parent != null && parent.isObject() ? (ObjectNode) parent.deepCopy() : NODES.objectNode();
        child.properties().forEach(entry -> out.set(entry.getKey(), entry.getValue()));
        return out;
    }

    private static JsonNode mergeValue(JsonNode parent, JsonNode child) {
        if (parent.isArray() && child.isArray()) return mergeRows(parent, child, SeedExtension::id, (old, row) -> row);
        if (parent.isObject() && child.isObject()) return mergeObjects(parent, child);
        return child;
    }

    private static ArrayNode mergeShippedPlugins(JsonNode parent, JsonNode child) {
        return mergeRows(parent, child, group -> text(group, "package"), (old, group) -> {
            ObjectNode out = (ObjectNode) old.deepCopy();
            out.set("instances", mergeRows(old.path("instances"), group.path("instances"), SeedExtension::id,
                    (oldInstance, instance) -> instance));
            return out;
        });
    }

    private static ArrayNode mergeRows(JsonNode parent, JsonNode child, Function<JsonNode, String> key,
            BinaryOperator<JsonNode> replace) {
        ArrayNode out = NODES.arrayNode();
        Map<String, Integer> indexes = new LinkedHashMap<>();
        for (JsonNode item : parent) {
            String id = key.apply(item);
            if (id != null && !indexes.containsKey(id)) indexes.put(id, out.size());
            out.add(item);
        }
        for (JsonNode item : child) {
            String id = key.apply(item);
            Integer index = id == null ? null : indexes.get(id);
            if (index == null) {
                if (id != null) indexes.put(id, out.size());
                out.add(item);
            } else {
                out.set(index, replace.apply(out.get(index), item));
            }
        }
        return out;
    }

    private static String id(JsonNode value) {
        return text(value, "id");
    }

    private static String text(JsonNode value, String field) {
        return value.isObject() && value.path(field).isString() ? value.path(field).asString() : null;
    }
}
