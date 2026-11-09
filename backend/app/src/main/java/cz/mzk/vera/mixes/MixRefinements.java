package cz.mzk.vera.mixes;

import static cz.mzk.vera.db.tables.Tables.MIXES;
import static cz.mzk.vera.db.tables.Tables.MIX_REVISIONS;
import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.max;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// PLAN-refine; PLAN-mix-revision. A refined leaf's active shares move in new revisions.
@Component
public class MixRefinements {
    private final DSLContext dsl;
    private final JsonMapper json;

    public MixRefinements(DSLContext dsl, JsonMapper json) {
        this.dsl = dsl;
        this.json = json;
    }

    public void refine(String categoryId, String childId, OffsetDateTime at) {
        var mixes = dsl.selectFrom(MIXES).where(MIXES.ARCHIVED_AT.isNull())
                .orderBy(MIXES.POSITION).fetch();
        for (var mix : mixes) {
            JsonNode before = json.readTree(mix.getShares().data());
            if (!before.has(categoryId)) {
                continue;
            }
            Map<String, Object> shares = new LinkedHashMap<>();
            before.properties().forEach(entry -> shares.put(entry.getKey(), entry.getValue()));
            shares.put(childId, 100);
            JsonNode next = json.valueToTree(shares);
            int revision = mix.getRevision() + 1;
            int position = dsl.select(coalesce(max(MIX_REVISIONS.POSITION), -1).add(1))
                    .from(MIX_REVISIONS).where(MIX_REVISIONS.MIX_ID.eq(mix.getId()))
                    .fetchOne(0, int.class);
            dsl.update(MIXES).set(MIXES.SHARES, JSONB.valueOf(next.toString()))
                    .set(MIXES.REVISION, revision).where(MIXES.ID.eq(mix.getId())).execute();
            dsl.insertInto(MIX_REVISIONS).set(MIX_REVISIONS.MIX_ID, mix.getId())
                    .set(MIX_REVISIONS.REVISION, revision)
                    .set(MIX_REVISIONS.SHARES, JSONB.valueOf(next.toString()))
                    .set(MIX_REVISIONS.AT, at).set(MIX_REVISIONS.LABEL, (String) null)
                    .set(MIX_REVISIONS.POSITION, position).execute();
        }
    }

    public void drop(String categoryId, OffsetDateTime at) {
        var mixes = dsl.selectFrom(MIXES).where(MIXES.ARCHIVED_AT.isNull())
                .orderBy(MIXES.POSITION).fetch();
        for (var mix : mixes) {
            JsonNode before = json.readTree(mix.getShares().data());
            if (!before.has(categoryId)) {
                continue;
            }
            Map<String, Object> shares = new LinkedHashMap<>();
            before.properties().forEach(entry -> shares.put(entry.getKey(), entry.getValue()));
            shares.remove(categoryId);
            JsonNode next = json.valueToTree(shares);
            int revision = mix.getRevision() + 1;
            int position = dsl.select(coalesce(max(MIX_REVISIONS.POSITION), -1).add(1))
                    .from(MIX_REVISIONS).where(MIX_REVISIONS.MIX_ID.eq(mix.getId()))
                    .fetchOne(0, int.class);
            dsl.update(MIXES).set(MIXES.SHARES, JSONB.valueOf(next.toString()))
                    .set(MIXES.REVISION, revision).where(MIXES.ID.eq(mix.getId())).execute();
            dsl.insertInto(MIX_REVISIONS).set(MIX_REVISIONS.MIX_ID, mix.getId())
                    .set(MIX_REVISIONS.REVISION, revision)
                    .set(MIX_REVISIONS.SHARES, JSONB.valueOf(next.toString()))
                    .set(MIX_REVISIONS.AT, at).set(MIX_REVISIONS.LABEL, (String) null)
                    .set(MIX_REVISIONS.POSITION, position).execute();
        }
    }
}
