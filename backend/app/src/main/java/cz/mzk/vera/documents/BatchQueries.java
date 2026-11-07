package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.BATCHES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static org.jooq.impl.DSL.count;

import cz.mzk.vera.web.Instants;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

// ENT-batch: serve submissions in insertion order with their request counts.
@Repository
public class BatchQueries {
    private final DSLContext dsl;

    public BatchQueries(DSLContext dsl) {
        this.dsl = dsl;
    }

    public List<Map<String, Object>> served() {
        var sizes = dsl.select(REQUESTS.BATCH_ID, count().as("size")).from(REQUESTS)
            .groupBy(REQUESTS.BATCH_ID).fetchMap(REQUESTS.BATCH_ID, r -> r.get("size", Integer.class));
        return dsl.selectFrom(BATCHES).orderBy(BATCHES.POSITION).fetch(row -> {
            Map<String, Object> source = row.getSourceInstanceId() == null ? null : Map.of(
                "instanceId", row.getSourceInstanceId(), "name", row.getSourceName());
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", row.getId());
            item.put("name", row.getName());
            item.put("submittedBy", row.getSubmittedBy());
            item.put("submittedAt", Instants.format(row.getSubmittedAt().toInstant()));
            item.put("size", sizes.getOrDefault(row.getId(), 0));
            item.put("source", source);
            return item;
        });
    }
}
