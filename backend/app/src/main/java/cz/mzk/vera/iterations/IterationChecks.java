package cz.mzk.vera.iterations;

import cz.mzk.vera.domain.entities.Defect;
import cz.mzk.vera.domain.entities.Document;
import cz.mzk.vera.domain.entities.Iteration;
import java.util.List;

// ACT-recheck; DOC-manual-page-count: one port for every iteration check run.
public interface IterationChecks {
    CheckResult run(Iteration iteration, Document document, Run run);

    enum Run { PAGE_COUNT, RECHECK }

    record CheckResult(List<Defect> defects, List<String> goneSubjects) {
        public CheckResult {
            defects = List.copyOf(defects);
            goneSubjects = List.copyOf(goneSubjects);
        }
    }
}
