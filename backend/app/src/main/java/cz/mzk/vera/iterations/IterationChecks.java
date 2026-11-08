package cz.mzk.vera.iterations;

import cz.mzk.vera.domain.entities.Defect;
import cz.mzk.vera.domain.entities.Document;
import cz.mzk.vera.domain.entities.Iteration;
import java.util.List;
import tools.jackson.databind.JsonNode;

// ACT-recheck; DOC-manual-page-count: one port for every iteration check run.
public interface IterationChecks {
    CheckResult run(Iteration iteration, Document document, Run run);

    CheckResult runWithPropertyValue(Iteration iteration, Document document, Run run,
            String key, JsonNode value);

    boolean readsProperty(String key);

    enum Run { PAGE_COUNT, RECHECK }

    record CheckResult(List<Defect> defects, List<String> goneSubjects) {
        public CheckResult {
            defects = List.copyOf(defects);
            goneSubjects = List.copyOf(goneSubjects);
        }
    }
}
