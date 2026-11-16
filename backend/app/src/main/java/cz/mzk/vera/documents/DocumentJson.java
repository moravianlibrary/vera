package cz.mzk.vera.documents;

import org.jooq.JSONB;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// DOC-property-values: parse stored JSON through the configured mapper.
@Component
final class DocumentJson {
    private final JsonMapper mapper;

    DocumentJson(JsonMapper mapper) {
        this.mapper = mapper;
    }

    JsonNode read(JSONB value) {
        return read(value.data());
    }

    JsonNode read(String value) {
        try {
            return mapper.readTree(value);
        } catch (JacksonException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
