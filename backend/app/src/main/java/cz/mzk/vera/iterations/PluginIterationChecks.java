package cz.mzk.vera.iterations;

import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR_KEYS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.domain.entities.Progress.valueOf;

import cz.mzk.vera.domain.entities.Defect;
import cz.mzk.vera.domain.entities.Document;
import cz.mzk.vera.domain.entities.Iteration;
import java.util.ArrayList;
import java.util.List;
import org.jooq.DSLContext;
import tools.jackson.databind.json.JsonMapper;
import org.springframework.stereotype.Component;

// ACT-recheck; DOC-manual-page-count; STAT-checks-after-scan: use the ingest plugin checks.
@Component
public class PluginIterationChecks implements IterationChecks {
    private final DSLContext dsl;
    private final IterationCheckRun checkRun;
    private final JsonMapper json;

    public PluginIterationChecks(DSLContext dsl, IterationCheckRun checkRun, JsonMapper json) {
        this.dsl = dsl;
        this.checkRun = checkRun;
        this.json = json;
    }

    @Override
    public CheckResult run(Iteration iteration, Document document, Run run) {
        var row = dsl.select(DOCUMENTS.TITLE, DOCUMENTS.TYPE, DOCUMENTS.SHELF_MARK,
                DOCUMENTS.UNIT_TYPE, DOCUMENTS.UNIT_VALUE)
                .from(DOCUMENTS).where(DOCUMENTS.ID.eq(document.id())).fetchOne();
        cz.mzk.vera.plugin.records.Document.Unit unit = row.get(DOCUMENTS.UNIT_TYPE) == null ? null
                : new cz.mzk.vera.plugin.records.Document.Unit(row.get(DOCUMENTS.UNIT_TYPE),
                        row.get(DOCUMENTS.UNIT_VALUE));
        cz.mzk.vera.plugin.records.Document record = new cz.mzk.vera.plugin.records.Document(document.id(),
                document.catalogId(), unit, row.get(DOCUMENTS.TITLE), row.get(DOCUMENTS.TYPE),
                row.get(DOCUMENTS.SHELF_MARK));
        List<String> identifiers = dsl.select(CATALOG_MIRROR_KEYS.VALUE).from(CATALOG_MIRROR_KEYS)
                .where(CATALOG_MIRROR_KEYS.CATALOG_ID.eq(document.catalogId()))
                .and(CATALOG_MIRROR_KEYS.KIND.eq("identifier"))
                .orderBy(CATALOG_MIRROR_KEYS.POSITION).fetch(CATALOG_MIRROR_KEYS.VALUE);
        List<IterationCheckRun.Value> values = new ArrayList<>(dsl.select(DOCUMENT_PROPERTY_SOURCES.KEY,
                DOCUMENT_PROPERTY_SOURCES.VALUE).from(DOCUMENT_PROPERTY_SOURCES)
                .where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq(document.id()))
                .orderBy(DOCUMENT_PROPERTY_SOURCES.POSITION)
                .fetch(rowValue -> new IterationCheckRun.Value(rowValue.get(DOCUMENT_PROPERTY_SOURCES.KEY),
                        json.readTree(rowValue.get(DOCUMENT_PROPERTY_SOURCES.VALUE).data()))));
        dsl.select(ITERATION_PROPERTY_SOURCES.KEY, ITERATION_PROPERTY_SOURCES.VALUE)
                .from(ITERATION_PROPERTY_SOURCES)
                .where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq(iteration.id()))
                .orderBy(ITERATION_PROPERTY_SOURCES.POSITION)
                .fetch(rowValue -> values.add(new IterationCheckRun.Value(
                        rowValue.get(ITERATION_PROPERTY_SOURCES.KEY),
                        json.readTree(rowValue.get(ITERATION_PROPERTY_SOURCES.VALUE).data()))));
        var checked = checkRun.run(record, values);
        List<Defect> found = new ArrayList<>();
        for (var answer : checked.validations()) {
            for (var defect : answer.answer().defects()) {
                String key = answer.instance().id() + ":" + defect.rule() + ":" + defect.field();
                String firstSeen = iteration.defects().stream().filter(old -> old.key().equals(key))
                        .map(Defect::firstSeenAt).findFirst().orElse("");
                found.add(new Defect(key, answer.instance().id(), defect.rule(), defect.field(), firstSeen));
            }
        }
        if (run == Run.PAGE_COUNT) {
            found.removeIf(defect -> "pages".equals(defect.subject()));
        }
        List<String> foundSubjects = found.stream().map(Defect::subject).toList();
        List<String> gone = iteration.defects().stream().map(Defect::subject).distinct()
                .filter(subject -> !foundSubjects.contains(subject)).toList();
        return new CheckResult(found, gone);
    }
}
