package cz.mzk.vera.plugins.jq_custody;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.custody.Custody;
import cz.mzk.vera.plugin.custody.PlaceAnswer;
import cz.mzk.vera.plugin.custody.PlaceInput;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.records.Request;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import net.thisptr.jackson.jq.BuiltinFunctionLoader;
import net.thisptr.jackson.jq.JsonQuery;
import net.thisptr.jackson.jq.Scope;
import net.thisptr.jackson.jq.Version;
import net.thisptr.jackson.jq.exception.JsonQueryException;

// PLG-api-kinds: Custody; ACCESS-custody-by-plugins.
public final class JqCustody implements Custody {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Version JQ_VERSION = Version.valueOf("1.6");

    @Override
    public PlaceAnswer place(PluginContext context, PlaceInput input) {
        if (input.custodyId() == null) {
            return new PlaceAnswer(List.of());
        }
        try {
            Scope scope = Scope.newEmptyScope();
            BuiltinFunctionLoader.getInstance().loadFunctions(JQ_VERSION, scope);
            JsonQuery query = JsonQuery.compile(context.configuration().get("expr"), JQ_VERSION);
            List<JsonNode> results = new ArrayList<>();
            query.apply(scope, jsonInput(input), results::add);
            boolean matches = results.stream().anyMatch(value -> value.isBoolean() && value.booleanValue());
            return new PlaceAnswer(matches ? List.of(input.custodyId()) : List.of());
        } catch (JsonQueryException exception) {
            throw new IllegalArgumentException("Could not evaluate custody expression.", exception);
        }
    }

    private JsonNode jsonInput(PlaceInput input) {
        Map<String, Object> request = requestFields(input.request());
        request.put("project", input.request().projectName());
        Map<String, Object> document = documentFields(input.document());
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("request", request);
        root.put("document", document);
        root.put("record", null);
        return JSON.valueToTree(root);
    }

    private Map<String, Object> requestFields(Request request) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("id", request.id());
        fields.put("documentId", request.documentId());
        fields.put("requesterId", request.requesterId());
        fields.put("at", request.at() == null ? null : request.at().toString());
        fields.put("reason", request.reason());
        fields.put("batchId", request.batchId());
        fields.put("projectId", request.projectId());
        fields.put("projectName", request.projectName());
        fields.put("checkedAt", request.checkedAt() == null ? null : request.checkedAt().toString());
        fields.put("decision", request.decision());
        return fields;
    }

    private Map<String, Object> documentFields(Document document) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("id", document.id());
        fields.put("catalogId", document.catalogId());
        Map<String, Object> unit = null;
        if (document.unit() != null) {
            unit = new LinkedHashMap<>();
            unit.put("type", document.unit().type());
            unit.put("value", document.unit().value());
        }
        fields.put("unit", unit);
        fields.put("title", document.title());
        fields.put("type", document.type());
        fields.put("shelfMark", document.shelfMark());
        fields.put("pageSources", new ArrayList<>(document.pageSources()));
        fields.put("registryRecords", new ArrayList<>(document.registryRecords()));
        fields.put("properties", new ArrayList<>(document.properties()));
        return fields;
    }
}
