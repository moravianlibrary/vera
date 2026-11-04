package cz.mzk.vera.web;

import com.networknt.schema.Error;
import com.networknt.schema.Schema;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.core.JacksonException;

/** Validates /api input and output against the OpenAPI document before it crosses the boundary. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public final class ContractFilter extends OncePerRequestFilter {
    private static final Logger LOGGER = LoggerFactory.getLogger(ContractFilter.class);
    private final ObjectMapper mapper;
    private final JsonNode document;
    private final SchemaRegistry registry;
    private final List<Operation> operations;

    public ContractFilter(ObjectMapper mapper, @Value("${VERA_CONTRACT_DIR}") String directory) throws IOException {
        this.mapper = mapper;
        Path contractFile = Path.of(directory, "openapi.json");
        this.document = mapper.readTree(contractFile.toFile());
        this.registry = SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12);
        this.operations = readOperations();
    }

    public List<String> operationIds() {
        return operations.stream().map(Operation::id).sorted().toList();
    }

    public boolean hasOperation(String method, String path) {
        return operations.stream()
                .anyMatch(operation -> operation.method().equals(method) && operation.path().equals(path));
    }

    public String operationId(String method, String path) {
        return operations.stream()
                .filter(operation -> operation.method().equals(method) && operation.path().equals(path))
                .map(Operation::id).findFirst().orElseThrow();
    }

    private List<Operation> readOperations() {
        List<Operation> result = new ArrayList<>();
        JsonNode paths = document.path("paths");
        paths.properties().forEach(path -> path.getValue().properties().forEach(method -> {
            JsonNode op = method.getValue();
            result.add(new Operation(path.getKey(), method.getKey().toUpperCase(),
                    op.path("operationId").asString(), op));
        }));
        return List.copyOf(result);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (!request.getRequestURI().startsWith(request.getContextPath() + "/api")) {
            chain.doFilter(request, response);
            return;
        }
        Match operation = findOperation(request, response);
        if (operation == null) return;
        byte[] input = checkParameters(request, response, operation);
        if (input == null) return;
        if (!checkBody(request, response, operation, input)) return;
        runAndCheckAnswer(request, response, chain, operation, input);
    }

    private Match findOperation(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String path = request.getRequestURI().substring(request.getContextPath().length() + 4);
        if (path.isEmpty()) path = "/";
        String routePath = path;
        List<Match> pathMatches = operations.stream()
                .filter(operation -> match(operation.path(), routePath) != null)
                .map(operation -> new Match(operation, match(operation.path(), routePath)))
                .toList();
        if (pathMatches.isEmpty()) {
            writeProblem(response, request, 404, "No endpoint answers " + path + ".");
            return null;
        }
        Match found = pathMatches.stream()
                .filter(candidate -> candidate.operation().method().equals(request.getMethod()))
                .findFirst().orElse(null);
        if (found == null) writeProblem(response, request, 405, path + " does not answer " + request.getMethod() + ".");
        return found;
    }

    private byte[] checkParameters(HttpServletRequest request, HttpServletResponse response, Match found)
            throws IOException {
        for (String queryName : request.getParameterMap().keySet()) {
            boolean declared = false;
            for (JsonNode parameter : found.operation().node().path("parameters")) {
                if ("query".equals(parameter.path("in").asString())
                        && queryName.equals(parameter.path("name").asString())) declared = true;
            }
            if (!declared) {
                writeInvalid(response, request,
                        List.of(new Issue("", "unrecognized_keys", "Unrecognized key: " + queryName)));
                return null;
            }
        }
        for (JsonNode parameter : found.operation().node().path("parameters")) {
            String name = parameter.path("name").asString();
            String in = parameter.path("in").asString();
            String value = in.equals("path") ? found.parameters().get(name) : request.getParameter(name);
            if (value == null && parameter.path("required").asBoolean()) {
                writeInvalid(response, request, List.of(new Issue("/" + name, "required", "Required")));
                return null;
            }
            if (value != null) {
                Object parameterValue;
                try {
                    parameterValue = parameterValue(value, parameter.path("schema"));
                } catch (NumberFormatException exception) {
                    parameterValue = value;
                }
                List<Issue> issues = validate(parameter.path("schema"), mapper.valueToTree(parameterValue));
                if (!issues.isEmpty()) {
                    writeInvalid(response, request, issues.stream()
                            .map(issue -> new Issue("/" + name + issue.pointer(), issue.code(), issue.detail()))
                            .toList());
                    return null;
                }
            }
        }
        return StreamUtils.copyToByteArray(request.getInputStream());
    }

    private boolean checkBody(HttpServletRequest request, HttpServletResponse response, Match found, byte[] input)
            throws IOException {
        if (found.operation().node().has("requestBody")) {
            JsonNode body;
            try {
                body = mapper.readTree(input);
            } catch (JacksonException exception) {
                writeProblem(response, request, 400, "The body is not JSON.");
                return false;
            }
            if (body == null) {
                writeProblem(response, request, 400, "The body is not JSON.");
                return false;
            }
            JsonNode schema = found.operation().node().path("requestBody").path("content")
                    .path("application/json").path("schema");
            List<Issue> issues = validate(schema, body);
            if (!issues.isEmpty()) {
                writeInvalid(response, request, issues);
                return false;
            }
        }
        return true;
    }

    private void runAndCheckAnswer(HttpServletRequest request, HttpServletResponse response, FilterChain chain,
            Match found, byte[] input) throws IOException, ServletException {
        BufferResponse buffered = new BufferResponse(response);
        chain.doFilter(new BodyRequest(request, input), buffered);
        byte[] output = buffered.bytes();
        int status = buffered.getStatus();
        JsonNode responseSchema = responseSchema(found.operation().node(), status);
        if (responseSchema != null && output.length > 0) {
            JsonNode answer;
            try {
                answer = mapper.readTree(output);
            } catch (JacksonException exception) {
                answer = mapper.nullNode();
            }
            List<Issue> issues = validate(responseSchema, answer);
            if (!issues.isEmpty()) {
                LOGGER.error("{} {} answered outside the contract: {}", request.getMethod(),
                        found.operation().path(), issues);
                writeProblem(response, request, 500,
                        "The answer does not fit the contract: " + issues.getFirst().detail(),
                        "contract.response", null);
                return;
            }
        }
        response.setStatus(status);
        buffered.copyHeaders();
        response.getOutputStream().write(output);
    }

    private JsonNode responseSchema(JsonNode operation, int status) {
        JsonNode response = operation.path("responses").path(Integer.toString(status));
        if (response.isMissingNode()) response = operation.path("responses").path("default");
        JsonNode content = response.path("content");
        JsonNode schema = content.path("application/json").path("schema");
        if (schema.isMissingNode()) schema = content.path("application/problem+json").path("schema");
        return schema.isMissingNode() ? null : schema;
    }

    private List<Issue> validate(JsonNode schemaNode, JsonNode value) {
        if (schemaNode == null || schemaNode.isMissingNode()) return List.of();
        try {
            Schema schema = registry.getSchema(resolve(schemaNode, new HashSet<>()));
            return schema.validate(value).stream()
                    .map(error -> new Issue(issuePointer(error), code(error.getKeyword()), error.getMessage()))
                    .toList();
        } catch (RuntimeException exception) {
            throw new IllegalStateException("Could not validate OpenAPI schema " + schemaNode, exception);
        }
    }

    private JsonNode resolve(JsonNode node, Set<String> resolving) {
        if (node.isObject()) {
            if (node.has("$ref")) {
                String ref = node.path("$ref").asString();
                if (!ref.startsWith("#/components/") || !resolving.add(ref)) {
                    throw new IllegalStateException("Unsupported or cyclic OpenAPI reference " + ref);
                }
                JsonNode target = document.at(ref.substring(1));
                JsonNode resolved = resolve(target, resolving);
                resolving.remove(ref);
                return resolved;
            }
            var result = mapper.createObjectNode();
            node.properties().forEach(entry -> result.set(entry.getKey(), resolve(entry.getValue(), resolving)));
            return result;
        }
        if (node.isArray()) {
            var result = mapper.createArrayNode();
            node.forEach(child -> result.add(resolve(child, resolving)));
            return result;
        }
        return node;
    }

    private void writeInvalid(HttpServletResponse response, HttpServletRequest request, List<Issue> issues)
            throws IOException {
        List<Map<String, String>> errors = issues.stream()
                .map(issue -> Map.of("pointer", issue.pointer(), "code", issue.code(), "detail", issue.detail()))
                .toList();
        writeProblem(response, request, 422, issues.getFirst().detail(), "invalid", errors);
    }

    private void writeProblem(HttpServletResponse response, HttpServletRequest request, int status, String detail)
            throws IOException {
        writeProblem(response, request, status, detail, null, null);
    }

    private void writeProblem(HttpServletResponse response, HttpServletRequest request, int status, String detail,
            String code, List<?> errors) throws IOException {
        var entity = Problems.response(status, detail, code, errors);
        response.setStatus(status);
        response.setContentType("application/problem+json");
        response.getOutputStream().write(mapper.writeValueAsBytes(entity.getBody()));
    }

    private static Object parameterValue(String value, JsonNode schema) {
        return switch (schema.path("type").asString()) {
            case "integer" -> Long.valueOf(value);
            case "number" -> Double.valueOf(value);
            case "boolean" -> value.equals("true") ? Boolean.TRUE : value.equals("false") ? Boolean.FALSE : value;
            case "array" -> Arrays.stream(value.split(","))
                    .map(item -> parameterValue(item, schema.path("items"))).toList();
            default -> value;
        };
    }

    private static String code(String keyword) {
        return switch (keyword) {
            case "required" -> "required";
            case "additionalProperties" -> "unrecognized_keys";
            case "type" -> "invalid_type";
            case "minimum", "exclusiveMinimum" -> "too_small";
            case "maximum", "exclusiveMaximum" -> "too_big";
            case "minLength", "minItems" -> "too_small";
            case "maxLength", "maxItems" -> "too_big";
            case "enum", "const" -> "invalid_value";
            default -> "invalid";
        };
    }

    private static String pointer(String location) {
        if (location == null || location.isEmpty() || location.equals("$")) return "";
        return location.startsWith("/") ? location : "/" + location.replace(".", "/");
    }

    private static String issuePointer(Error error) {
        String location = pointer(error.getInstanceLocation().toString());
        if ("required".equals(error.getKeyword()) && error.getProperty() != null) {
            return location + "/" + error.getProperty().replace("~", "~0").replace("/", "~1");
        }
        return location;
    }

    private static Map<String, String> match(String template, String path) {
        String[] expected = template.split("/");
        String[] actual = path.split("/");
        if (expected.length != actual.length) return null;
        Map<String, String> values = new LinkedHashMap<>();
        for (int i = 0; i < expected.length; i++) {
            if (expected[i].startsWith("{") && expected[i].endsWith("}")) {
                values.put(expected[i].substring(1, expected[i].length() - 1), actual[i]);
            }
            else if (!expected[i].equals(actual[i])) return null;
        }
        return values;
    }

    private record Operation(String path, String method, String id, JsonNode node) {}
    private record Match(Operation operation, Map<String, String> parameters) {}
    private record Issue(String pointer, String code, String detail) {}

    private static final class BodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;
        BodyRequest(HttpServletRequest request, byte[] body) { super(request); this.body = body; }
        @Override public ServletInputStream getInputStream() {
            var stream = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override public int read() { return stream.read(); }
                @Override public boolean isFinished() { return stream.available() == 0; }
                @Override public boolean isReady() { return true; }
                @Override public void setReadListener(ReadListener listener) { }
            };
        }
    }

    private static final class BufferResponse extends HttpServletResponseWrapper {
        private final ByteArrayOutputStream body = new ByteArrayOutputStream();
        private final Map<String, List<String>> headers = new LinkedHashMap<>();
        BufferResponse(HttpServletResponse response) { super(response); }
        byte[] bytes() { return body.toByteArray(); }
        @Override
        public boolean containsHeader(String name) {
            return headers.containsKey(name) || super.containsHeader(name);
        }
        void copyHeaders() { headers.forEach((name, values) -> values.forEach(value -> super.addHeader(name, value))); }
        @Override public void flushBuffer() { }
        @Override public ServletOutputStream getOutputStream() {
            return new ServletOutputStream() {
                @Override public void write(int value) { body.write(value); }
                @Override public boolean isReady() { return true; }
                @Override public void setWriteListener(WriteListener listener) { }
            };
        }
        @Override public PrintWriter getWriter() { return new PrintWriter(body, true, StandardCharsets.UTF_8); }
        @Override public void setHeader(String name, String value) {
            if (value == null) headers.remove(name);
            else headers.put(name, new ArrayList<>(List.of(value)));
        }
        @Override
        public void addHeader(String name, String value) {
            headers.computeIfAbsent(name, ignored -> new ArrayList<>()).add(value);
        }
    }
}
