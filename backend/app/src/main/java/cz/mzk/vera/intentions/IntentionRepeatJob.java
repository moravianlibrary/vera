package cz.mzk.vera.intentions;

import static cz.mzk.vera.db.tables.Tables.ARCHIVED_INTENTION_SNAPSHOTS;
import static cz.mzk.vera.db.tables.Tables.INTENTIONS;
import static cz.mzk.vera.db.tables.Tables.INTENTION_TEMPLATES;

import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.domain.intentions.Intentions;
import cz.mzk.vera.events.EventChanges;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.jobs.Job;
import cz.mzk.vera.jobs.JobKind;
import cz.mzk.vera.web.Instants;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

// LC-INT-repeat; LC-INT-archive; B5. The queued date makes obsolete repeats harmless.
@Component
class IntentionRepeatJob implements JobKind<Void> {
    private final Clock clock;
    private final RepeatQueue queue;
    private final ProjectIntentionWrites writer;
    private final IntentionReads reads;
    private final EventRecorder events;
    private final JsonMapper json;

    IntentionRepeatJob(
            Clock clock,
            RepeatQueue queue,
            ProjectIntentionWrites writer,
            IntentionReads reads,
            EventRecorder events,
            JsonMapper json) {
        this.clock = clock;
        this.queue = queue;
        this.writer = writer;
        this.reads = reads;
        this.events = events;
        this.json = json;
    }

    @Override
    public String name() {
        return "intention.repeat";
    }

    @Override
    public Void call(Job job) {
        return null;
    }

    @Override
    public void apply(DSLContext dsl, Job job, Void found) {
        String id = job.payload().path("repeatId").asString();
        LocalDate queuedFor = LocalDate.parse(job.payload().path("nextOn").asString());
        var template = dsl.selectFrom(INTENTION_TEMPLATES)
                .where(INTENTION_TEMPLATES.ID.eq(id))
                .fetchOne();
        if (template == null || !template.getNextOn().equals(queuedFor)) {
            return;
        }

        LocalDate today = LocalDate.now(clock);
        if (today.isBefore(queuedFor)) {
            return;
        }
        Intentions.RepeatPeriod period = Intentions.RepeatPeriod.valueOf(template.getEvery());
        RepeatPeriods.Period bounds = RepeatPeriods.of(period, today);
        if (bounds.startsOn().isBefore(queuedFor)) {
            bounds = RepeatPeriods.of(period, queuedFor);
        }

        boolean alreadyMade = dsl.fetchExists(INTENTIONS,
                INTENTIONS.TEMPLATE_ID.eq(id).and(INTENTIONS.COUNTS_FROM.eq(bounds.startsOn())));
        if (!alreadyMade) {
            if (template.getIsArchivingPrevious()) {
                archiveLatest(dsl, id);
            }
            String name = template.getNamePattern().replace("{period}", bounds.name());
            String occurrenceId = writer.createPlanned(
                    dsl,
                    name,
                    template.getDescription(),
                    template.getFundingKind(),
                    template.getFundingProjectId(),
                    template.getScopeCategoryId(),
                    template.getScopeConditions(),
                    bounds.startsOn().toString(),
                    bounds.endsOn().toString(),
                    template.getTargetPages(),
                    template.getDistributionId(),
                    template.getMixRevision(),
                    id);
            var at = clock.instant();
            events.record(new EventInput(
                    EventCode.INTENTION_CREATED,
                    "intention",
                    occurrenceId,
                    null,
                    new EventInput.System(),
                    UUID.randomUUID().toString(),
                    at,
                    EventChanges.configurationOf(json, List.of()),
                    null));
        }

        LocalDate nextOn = Intentions.nextPeriodStartOf(period, bounds.endsOn());
        dsl.update(INTENTION_TEMPLATES)
                .set(INTENTION_TEMPLATES.NEXT_ON, nextOn)
                .where(INTENTION_TEMPLATES.ID.eq(id))
                .execute();
        queue.queue(dsl, id, nextOn);
    }

    private void archiveLatest(DSLContext dsl, String templateId) {
        var previous = dsl.selectFrom(INTENTIONS)
                .where(INTENTIONS.TEMPLATE_ID.eq(templateId))
                .and(INTENTIONS.ARCHIVED_AT.isNull())
                .orderBy(INTENTIONS.COUNTS_FROM.desc(), INTENTIONS.POSITION.desc())
                .limit(1)
                .fetchOne();
        if (previous == null) {
            return;
        }
        String id = previous.getId();
        var at = clock.instant();
        OffsetDateTime storedAt = at.atOffset(ZoneOffset.UTC);
        Integer pinnedRevision = previous.getMixRevision();
        if (pinnedRevision == null && previous.getDistributionId() != null) {
            pinnedRevision = dsl.select(cz.mzk.vera.db.tables.Tables.MIXES.REVISION)
                    .from(cz.mzk.vera.db.tables.Tables.MIXES)
                    .where(cz.mzk.vera.db.tables.Tables.MIXES.ID.eq(previous.getDistributionId()))
                    .fetchOne(cz.mzk.vera.db.tables.Tables.MIXES.REVISION);
        }
        dsl.update(INTENTIONS)
                .set(INTENTIONS.ARCHIVED_ACTOR_KIND, "system")
                .set(INTENTIONS.ARCHIVED_ACTOR_USER_ID, (String) null)
                .set(INTENTIONS.ARCHIVED_AT, storedAt)
                .set(INTENTIONS.MIX_REVISION, pinnedRevision)
                .where(INTENTIONS.ID.eq(id))
                .execute();
        var snapshot = reads.archiveSnapshot(dsl, id);
        dsl.insertInto(ARCHIVED_INTENTION_SNAPSHOTS)
                .set(ARCHIVED_INTENTION_SNAPSHOTS.INTENTION_ID, id)
                .set(ARCHIVED_INTENTION_SNAPSHOTS.CAPTURED_ROW,
                        JSONB.valueOf(json.writeValueAsString(snapshot.get("captured_row"))))
                .set(ARCHIVED_INTENTION_SNAPSHOTS.MIX_TREE,
                        snapshot.get("mix_tree") == null ? null
                                : JSONB.valueOf(json.writeValueAsString(snapshot.get("mix_tree"))))
                .set(ARCHIVED_INTENTION_SNAPSHOTS.CATEGORY_TREE,
                        JSONB.valueOf(json.writeValueAsString(snapshot.get("category_tree"))))
                .execute();
        events.record(new EventInput(
                EventCode.INTENTION_ARCHIVED,
                "intention",
                id,
                null,
                new EventInput.System(),
                UUID.randomUUID().toString(),
                at,
                EventChanges.configurationOf(
                        json,
                        List.of(EventChanges.change("archived_at", null, Instants.format(at)))),
                null));
    }
}
