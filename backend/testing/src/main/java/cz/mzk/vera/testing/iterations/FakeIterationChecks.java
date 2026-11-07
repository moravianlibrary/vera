package cz.mzk.vera.testing.iterations;

import cz.mzk.vera.domain.entities.Defect;
import cz.mzk.vera.domain.entities.Document;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.iterations.IterationChecks;
import cz.mzk.vera.testing.seeds.SeedReader;
import java.util.ArrayList;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

// ACT-recheck; DOC-manual-page-count: play the seed's catalog repairs until ingest installs checks.
@Component
@Profile("test")
public class FakeIterationChecks implements IterationChecks {
    private final SeedReader seeds;

    public FakeIterationChecks(SeedReader seeds) {
        this.seeds = seeds;
    }

    @Override
    public CheckResult run(Iteration iteration, Document document, Run run) {
        List<String> repaired = new ArrayList<>();
        if (run == Run.PAGE_COUNT) {
            repaired.add("pages");
        } else {
            seeds.read("base").path("fakes").path("catalogRepairs").path(document.catalogId())
                    .forEach(value -> repaired.add(value.asString()));
        }
        List<Defect> remaining = iteration.defects().stream()
                .filter(defect -> !repaired.contains(defect.subject())).toList();
        List<String> goneSubjects = iteration.defects().stream().map(Defect::subject)
                .filter(repaired::contains).distinct().toList();
        return new CheckResult(remaining, goneSubjects);
    }
}
