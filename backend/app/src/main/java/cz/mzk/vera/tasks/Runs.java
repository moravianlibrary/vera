package cz.mzk.vera.tasks;

import static cz.mzk.vera.db.tables.Tables.RUNS;
import static cz.mzk.vera.db.tables.Tables.RUN_LOG;
import static cz.mzk.vera.db.tables.Tables.RUN_TARGETS;
import static cz.mzk.vera.db.tables.Tables.USERS;

import cz.mzk.vera.jobs.Jobs;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// PLG-run-items; a cancelled row is observed by its worker before it handles another item.
@Component
public class Runs {
    private final DSLContext dsl;
    private final Jobs jobs;
    private final RunSets sets;
    private final Clock clock;
    private final JsonMapper json;

    public Runs(DSLContext dsl, Jobs jobs, RunSets sets, Clock clock, JsonMapper json) {
        this.dsl = dsl;
        this.jobs = jobs;
        this.sets = sets;
        this.clock = clock;
        this.json = json;
    }

    @Transactional
    public String start(String what, String instanceId, String coreName,
            Map<String, Object> trigger, String startedBy, String rerunOf) {
        List<RunSets.Target> targets = sets.forInstance(dsl, instanceId);
        return start(what, instanceId, coreName, trigger, startedBy, rerunOf, targets, List.of());
    }

    @Transactional
    public String startPlacing(String startedBy, Map<String, Object> from) {
        Map<String, Object> trigger = new LinkedHashMap<>();
        trigger.put("kind", "manual");
        trigger.put("from", from);
        List<RunSets.PlacementTarget> targets = sets.openProposals(dsl);
        return start("Placing open proposals again", null, "VERA", trigger, startedBy, null,
                List.of(), targets);
    }

    private String start(String what, String instanceId, String coreName,
            Map<String, Object> trigger, String startedBy, String rerunOf,
            List<RunSets.Target> targets, List<RunSets.PlacementTarget> placementTargets) {
        int highest = dsl.select(RUNS.ID).from(RUNS).fetch(RUNS.ID).stream()
                .map(idValue -> Integer.parseInt(idValue.substring(2)))
                .mapToInt(Integer::intValue).max().orElse(0);
        String id = "T-" + (highest + 1);
        OffsetDateTime now = clock.instant().atOffset(ZoneOffset.UTC);
        dsl.insertInto(RUNS)
                .set(RUNS.ID, id)
                .set(RUNS.WHAT, what)
                .set(RUNS.INSTANCE_ID, instanceId)
                .set(RUNS.CORE_NAME, coreName)
                .set(RUNS.TRIGGER, JSONB.valueOf(json.writeValueAsString(trigger)))
                .set(RUNS.STARTED_BY, startedBy)
                .set(RUNS.STATE, "Running")
                .set(RUNS.STARTED_AT, now)
                .set(RUNS.ITEM_COUNT, targets.size() + placementTargets.size())
                .set(RUNS.DONE_COUNT, 0)
                .set(RUNS.CHANGES, JSONB.valueOf("[]"))
                .set(RUNS.RERUN_OF, rerunOf)
                .execute();
        int position = 0;
        for (RunSets.Target target : targets) {
            dsl.insertInto(RUN_TARGETS)
                    .set(RUN_TARGETS.RUN_ID, id)
                    .set(RUN_TARGETS.POSITION, position++)
                    .set(RUN_TARGETS.DOCUMENT_ID, target.documentId())
                    .set(RUN_TARGETS.ITERATION_ID, target.iterationId())
                    .execute();
        }
        position = 0;
        for (RunSets.PlacementTarget target : placementTargets) {
            dsl.insertInto(RUN_TARGETS)
                    .set(RUN_TARGETS.RUN_ID, id)
                    .set(RUN_TARGETS.POSITION, position++)
                    .set(RUN_TARGETS.DOCUMENT_ID, target.documentId())
                    .set(RUN_TARGETS.REQUEST_ID, target.requestId())
                    .execute();
        }
        JsonNode from = json.valueToTree(trigger.get("from"));
        String triggerWords = "by " + nameOf(startedBy) + ", from " + from.path("label").asString();
        dsl.insertInto(RUN_LOG)
                .set(RUN_LOG.RUN_ID, id)
                .set(RUN_LOG.AT, now)
                .set(RUN_LOG.TEXT, id + " started — " + what + " (" + triggerWords + ")")
                .set(RUN_LOG.IS_ERROR, false)
                .set(RUN_LOG.POSITION, 0)
                .execute();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("runId", id);
        payload.put("offset", 0);
        jobs.enqueue(dsl, "plugin.run", clock.instant(), payload);
        return id;
    }

    public boolean isCancelled(String runId) {
        return dsl.fetchExists(dsl.selectFrom(RUNS)
                .where(RUNS.ID.eq(runId))
                .and(RUNS.STATE.eq("Cancelled")));
    }

    private String nameOf(String userId) {
        String name = dsl.select(USERS.NAME).from(USERS).where(USERS.ID.eq(userId)).fetchOne(USERS.NAME);
        return name == null ? userId : name;
    }
}
