package cz.mzk.vera.tasks;

import cz.mzk.vera.domain.Names;
import java.util.Map;
import org.jooq.JSONB;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

// UI-names: a run keeps one label, made when it starts; like a repeat's occurrence, Czech first.
final class RunLabels {
    private RunLabels() {}

    static String ofSchedule(JSONB names, JsonMapper json) {
        Map<String, String> byLanguage = json.readValue(names.data(), new TypeReference<Map<String, String>>() { });
        return Names.nameIn(byLanguage, "cs");
    }
}
