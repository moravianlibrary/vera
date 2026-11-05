package cz.mzk.vera.events;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

public final class EventChanges {
    private EventChanges() {}

    public static Map<String, Object> change(String field, Object from, Object to) {
        Map<String, Object> change = new LinkedHashMap<>();
        change.put("field", field);
        change.put("from", from);
        change.put("to", to);
        return change;
    }

    public static ObjectNode configurationOf(JsonMapper json, List<Map<String, Object>> changes) {
        return json.createObjectNode().set("changes", json.valueToTree(changes));
    }
}
