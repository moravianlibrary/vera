package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginUnavailable;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.LinkedHashMap;

// PLG-api-call. The fake world encodes arbitrary property values as JSON form fields.
final class IngestWire {
    private IngestWire() {}

    static Map<String, List<String>> call(PluginContext context, String kind, String operation,
            String documentId, String catalogId) {
        return call(context, kind, operation, documentId, catalogId, List.of());
    }

    static Map<String, List<String>> call(PluginContext context, String kind, String operation,
            String documentId, String catalogId, List<String> identifiers) {
        return call(context, kind, operation, documentId, catalogId, null, identifiers);
    }

    static Map<String, List<String>> call(PluginContext context, String kind, String operation,
            String documentId, String catalogId, String unit, List<String> identifiers) {
        Map<String, List<String>> fields = Wire.fields();
        Wire.put(fields, "kind", kind);
        Wire.put(fields, "documentId", documentId);
        Wire.put(fields, "catalogId", catalogId);
        Wire.put(fields, "unit", unit);
        identifiers.forEach(identifier -> Wire.put(fields, "identifier", identifier));
        return Wire.send(context, operation, fields);
    }

    static void check(Map<String, List<String>> answer) {
        if (Wire.first(answer, "interrupted") != null) {
            throw new PluginUnavailable("Fake plugin timed out.");
        }
        if (Wire.first(answer, "malformed") != null) {
            throw new IllegalStateException("Fake world returned a malformed plugin answer.");
        }
    }

    static List<String> aligned(Map<String, List<String>> fields, String first, String second) {
        List<String> left = Wire.all(fields, first);
        List<String> right = Wire.all(fields, second);
        if (left.size() != right.size()) {
            throw new IllegalStateException("Fake world returned misaligned plugin fields.");
        }
        return left;
    }

    static List<String> aligned(Map<String, List<String>> fields, String first, String second, String third) {
        List<String> left = aligned(fields, first, second);
        if (left.size() != Wire.all(fields, third).size()) {
            throw new IllegalStateException("Fake world returned misaligned plugin fields.");
        }
        return left;
    }

    static List<String> aligned(Map<String, List<String>> fields, String first, String second, String third,
            String fourth) {
        List<String> left = aligned(fields, first, second, third);
        if (left.size() != Wire.all(fields, fourth).size()) {
            throw new IllegalStateException("Fake world returned misaligned plugin fields.");
        }
        return left;
    }

    static Object jsonValue(String json) {
        return new JsonValueParser(json).parse();
    }

    private static final class JsonValueParser {
        private final String source;
        private int position;

        JsonValueParser(String source) {
            this.source = source;
        }

        Object parse() {
            Object value = value();
            whitespace();
            if (position != source.length()) {
                throw new IllegalStateException("Fake world returned invalid JSON.");
            }
            return value;
        }

        private Object value() {
            whitespace();
            if (position >= source.length()) {
                throw new IllegalStateException("Fake world returned empty JSON.");
            }
            char current = source.charAt(position);
            if (current == '"') {
                return string();
            }
            if (current == '{') {
                return object();
            }
            if (current == '[') {
                return array();
            }
            if (source.startsWith("true", position)) {
                position += 4;
                return true;
            }
            if (source.startsWith("false", position)) {
                position += 5;
                return false;
            }
            if (source.startsWith("null", position)) {
                position += 4;
                return null;
            }
            return number();
        }

        private Map<String, Object> object() {
            Map<String, Object> result = new LinkedHashMap<>();
            position++;
            whitespace();
            if (take('}')) {
                return result;
            }
            do {
                whitespace();
                String key = string();
                whitespace();
                require(':');
                result.put(key, value());
                whitespace();
            } while (take(','));
            require('}');
            return result;
        }

        private List<Object> array() {
            List<Object> result = new ArrayList<>();
            position++;
            whitespace();
            if (take(']')) {
                return result;
            }
            do {
                result.add(value());
                whitespace();
            } while (take(','));
            require(']');
            return result;
        }

        private String string() {
            require('"');
            StringBuilder result = new StringBuilder();
            while (position < source.length()) {
                char current = source.charAt(position++);
                if (current == '"') {
                    return result.toString();
                }
                if (current != '\\') {
                    result.append(current);
                    continue;
                }
                char escaped = source.charAt(position++);
                switch (escaped) {
                    case '"', '\\', '/' -> result.append(escaped);
                    case 'b' -> result.append('\b');
                    case 'f' -> result.append('\f');
                    case 'n' -> result.append('\n');
                    case 'r' -> result.append('\r');
                    case 't' -> result.append('\t');
                    case 'u' -> {
                        result.append((char) Integer.parseInt(source.substring(position, position + 4), 16));
                        position += 4;
                    }
                    default -> throw new IllegalStateException("Fake world returned invalid JSON string.");
                }
            }
            throw new IllegalStateException("Fake world returned unterminated JSON string.");
        }

        private Number number() {
            int start = position;
            while (position < source.length() && "-+0123456789.eE".indexOf(source.charAt(position)) >= 0) {
                position++;
            }
            String raw = source.substring(start, position);
            try {
                if (raw.contains(".") || raw.contains("e") || raw.contains("E")) {
                    return Double.valueOf(raw);
                }
                return Long.valueOf(raw);
            } catch (NumberFormatException exception) {
                throw new IllegalStateException("Fake world returned invalid JSON number.", exception);
            }
        }

        private void whitespace() {
            while (position < source.length() && Character.isWhitespace(source.charAt(position))) {
                position++;
            }
        }

        private boolean take(char expected) {
            if (position < source.length() && source.charAt(position) == expected) {
                position++;
                return true;
            }
            return false;
        }

        private void require(char expected) {
            if (!take(expected)) {
                throw new IllegalStateException("Fake world returned invalid JSON structure.");
            }
        }
    }
}
