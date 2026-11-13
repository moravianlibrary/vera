package cz.mzk.vera.jobs;

import static cz.mzk.vera.db.tables.Tables.JOBS;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import cz.mzk.vera.telemetry.Telemetry;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

// B5. Enqueue joins the caller's transaction.
@Component
public final class Jobs {
    private final JsonMapper json;

    public Jobs(JsonMapper json) {
        this.json = json;
    }

    public long enqueue(DSLContext dsl, String kind, Instant dueAt, Object payload) {
        String traceParent = Telemetry.traceParent();
        var row = dsl.insertInto(JOBS)
                .set(JOBS.KIND, kind)
                .set(JOBS.DUE_AT, dueAt.atOffset(ZoneOffset.UTC))
                .set(JOBS.TRACE_PARENT, traceParent)
                .set(JOBS.PAYLOAD, JSONB.valueOf(
                        json.writeValueAsString(payload == null ? Map.of() : payload)))
                .returning(JOBS.ID)
                .fetchOne();
        return row == null ? 0 : row.getId();
    }
}
