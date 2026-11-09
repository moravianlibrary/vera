package cz.mzk.vera.intentions;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.DIGITIZATION_LISTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_STATES;
import static cz.mzk.vera.db.tables.Tables.INTENTIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.MIXES;
import static cz.mzk.vera.db.tables.Tables.MIX_REVISIONS;
import static cz.mzk.vera.db.tables.Tables.PROPERTY_DEFINITIONS;

import cz.mzk.vera.db.tables.tables.records.IntentionsRecord;
import cz.mzk.vera.domain.properties.Properties;
import cz.mzk.vera.domain.properties.Properties.PropertyValues;
import cz.mzk.vera.domain.properties.Properties.Source;
import cz.mzk.vera.domain.entities.Cancellation;
import cz.mzk.vera.domain.entities.CancellationCause;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.entities.DigitizationList;
import cz.mzk.vera.domain.entities.Distribution;
import cz.mzk.vera.domain.entities.Intention;
import cz.mzk.vera.domain.entities.IntentionFunding;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.PropertyCondition;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.intentions.Intentions.CountingData;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.function.Function;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Repository;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

// PLAN-counting; PLAN-target; PLAN-mix-revision; the list and project reads share this stored snapshot.
@Repository
public class CountingReads {
    private final DSLContext dsl;
    private final JsonMapper mapper;
    private final Clock clock;

    public CountingReads(DSLContext dsl, JsonMapper mapper, Clock clock) {
        this.dsl = dsl;
        this.mapper = mapper;
        this.clock = clock;
    }

    // countingData: PLAN-counting; fetch each collection in batches and page sources once.
    public CountingSnapshot countingData() {
        List<StoredIntention> intentions = dsl.selectFrom(INTENTIONS)
                .orderBy(INTENTIONS.POSITION).fetch(this::storedIntention);
        Map<String, List<StoredRevision>> revisions = new LinkedHashMap<>();
        dsl.selectFrom(MIX_REVISIONS)
                .orderBy(MIX_REVISIONS.MIX_ID, MIX_REVISIONS.POSITION)
                .fetch().forEach(row -> revisions.computeIfAbsent(row.getMixId(),
                        ignored -> new ArrayList<>()).add(new StoredRevision(row.getRevision(),
                                readShares(row.getShares()), row.getAt().toInstant().toString(),
                                row.getLabel())));
        List<StoredMix> mixes = dsl.selectFrom(MIXES).orderBy(MIXES.POSITION)
                .fetch(row -> new StoredMix(row.getId(), row.getName(), readShares(row.getShares()),
                        row.getRevision(), instant(row.getArchivedAt()),
                        revisions.getOrDefault(row.getId(), List.of())));
        List<Category> categories = dsl.selectFrom(CATEGORIES)
                .fetch(row -> new Category(row.getId(), row.getParentId()));
        List<DigitizationList> lists = dsl.selectFrom(DIGITIZATION_LISTS)
                .orderBy(DIGITIZATION_LISTS.POSITION)
                .fetch(row -> new DigitizationList(row.getId(), row.getName(),
                        row.getStartsOn().toString(), row.getEndsOn().toString(), row.getTargetPages(),
                        row.getDoneAt() == null ? null : row.getDoneAt().toInstant().toString()));
        List<Iteration> iterations = dsl.selectFrom(ITERATIONS)
                .fetch(row -> new Iteration(row.getId(), row.getDocumentId(), row.getAttempt(),
                        row.getRequestId(), row.getCategoryId(), row.getProjectId(),
                        Progress.valueOf(row.getProgress()), null, null,
                        row.getCancellationCause() == null ? null : new Cancellation(
                                CancellationCause.valueOf(row.getCancellationCause())),
                        List.of(), List.of(), List.of(), row.getListId(),
                        row.getDigitizedAt() == null ? null : row.getDigitizedAt().toInstant().toString()));
        Map<String, Integer> pageCounts = new LinkedHashMap<>();
        dsl.select(DOCUMENT_STATES.DOCUMENT_ID, DOCUMENT_STATES.PAGE_COUNT)
                .from(DOCUMENT_STATES).fetch().forEach(row -> {
                    if (row.get(DOCUMENT_STATES.PAGE_COUNT) != null) {
                        pageCounts.put(row.get(DOCUMENT_STATES.DOCUMENT_ID),
                                row.get(DOCUMENT_STATES.PAGE_COUNT));
                    }
                });
        Map<String, String> about = new LinkedHashMap<>();
        dsl.selectFrom(PROPERTY_DEFINITIONS).fetch()
                .forEach(row -> about.put(row.getKey(), row.getAbout()));
        Map<String, List<PropertyValues>> documentProperties = new LinkedHashMap<>();
        Map<String, List<PropertyValues>> iterationProperties = new LinkedHashMap<>();
        loadPropertySources(documentProperties, true);
        loadPropertySources(iterationProperties, false);
        Function<Iteration, Integer> pagesOf = iteration -> pageCounts.get(iteration.documentId());
        String today = LocalDate.now(clock).toString();
        CountingData rules = new CountingData(categories, lists, iterations, pagesOf,
                (conditions, iteration) -> meetsConditions(conditions, iteration, about,
                        documentProperties, iterationProperties, today));
        return new CountingSnapshot(intentions, mixes, rules, pagesOf);
    }

    // overallIntention: the mock throws when the seed has no overall intention.
    public StoredIntention overallIntention(CountingSnapshot data) {
        return data.intentions().stream().filter(intention -> intention.rule().isOverall()).findFirst()
                .orElseThrow(() -> new IllegalStateException("No Overall intention"));
    }

    // intentionOf: each project owns one intention; a missing row fails loudly like the mock.
    public StoredIntention intentionOf(CountingSnapshot data, String projectId) {
        return data.intentions().stream().filter(intention -> projectId.equals(intention.projectId()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Project " + projectId + " has no intention"));
    }

    // distributionOf: PLAN-mix-revision; an intention pins the selected historical revision.
    public StoredDistribution distributionOf(CountingSnapshot data, StoredIntention intention) {
        if (intention.distributionId() == null) {
            throw new IllegalStateException("No mix " + intention.distributionId());
        }
        StoredMix mix = data.mixes().stream()
                .filter(candidate -> candidate.id().equals(intention.distributionId()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No mix " + intention.distributionId()));
        if (intention.mixRevision() == null) {
            return new StoredDistribution(mix.id(), mix.name(), mix.revision(),
                    new Distribution(mix.shares()));
        }
        StoredRevision revision = mix.revisions().stream()
                .filter(candidate -> candidate.revision() == intention.mixRevision()).findFirst()
                .orElseThrow(() -> new IllegalStateException("No revision " + intention.mixRevision()
                        + " of mix " + mix.id()));
        return new StoredDistribution(mix.id(), mix.name(), revision.revision(),
                new Distribution(revision.shares()));
    }

    private StoredIntention storedIntention(IntentionsRecord row) {
        List<PropertyCondition> conditions = row.get(INTENTIONS.SCOPE_CONDITIONS) == null ? List.of()
                : readConditions(row.get(INTENTIONS.SCOPE_CONDITIONS));
        Intention rule = new Intention(row.get(INTENTIONS.ID),
                new IntentionFunding(row.get(INTENTIONS.FUNDING_KIND),
                        row.get(INTENTIONS.FUNDING_PROJECT_ID)),
                row.get(INTENTIONS.SCOPE_CATEGORY_ID), conditions, row.get(INTENTIONS.COUNTS_FROM).toString(),
                row.get(INTENTIONS.ENDS_ON) == null ? null : row.get(INTENTIONS.ENDS_ON).toString(),
                row.get(INTENTIONS.TARGET_PAGES), row.get(INTENTIONS.IS_OVERALL),
                instant(row.get(INTENTIONS.ARCHIVED_AT)));
        return new StoredIntention(rule, row.get(INTENTIONS.NAME), row.get(INTENTIONS.PROJECT_ID),
                row.get(INTENTIONS.DISTRIBUTION_ID), row.get(INTENTIONS.MIX_REVISION));
    }

    private List<PropertyCondition> readConditions(JSONB json) {
        try {
            return mapper.readValue(json.data(), new TypeReference<>() {});
        } catch (JacksonException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private Map<String, Double> readShares(JSONB json) {
        try {
            return mapper.readValue(json.data(), new TypeReference<>() {});
        } catch (JacksonException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void loadPropertySources(Map<String, List<PropertyValues>> properties, boolean document) {
        Map<String, Map<String, List<Source>>> values = new LinkedHashMap<>();
        if (document) {
            dsl.selectFrom(DOCUMENT_PROPERTY_SOURCES)
                    .orderBy(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID, DOCUMENT_PROPERTY_SOURCES.KEY,
                            DOCUMENT_PROPERTY_SOURCES.POSITION)
                    .fetch().forEach(row -> addSource(values, row.getDocumentId(), row.getKey(),
                            row.getSource(), row.getTier(), row.getValue(), row.getObservedAt(),
                            row.getSetBy()));
        } else {
            dsl.selectFrom(ITERATION_PROPERTY_SOURCES)
                    .orderBy(ITERATION_PROPERTY_SOURCES.ITERATION_ID, ITERATION_PROPERTY_SOURCES.KEY,
                            ITERATION_PROPERTY_SOURCES.POSITION)
                    .fetch().forEach(row -> addSource(values, row.getIterationId(), row.getKey(),
                            row.getSource(), row.getTier(), row.getValue(), row.getObservedAt(),
                            row.getSetBy()));
        }
        values.forEach((owner, keyed) -> properties.put(owner, keyed.entrySet().stream()
                .map(entry -> new PropertyValues(entry.getKey(), entry.getValue())).toList()));
    }

    private void addSource(Map<String, Map<String, List<Source>>> properties, String owner, String key,
            JSONB sourceValue, int tier, JSONB propertyValue, OffsetDateTime observedAt,
            String setBy) {
        var source = mapper.readTree(sourceValue.data());
        String kind = source.path("kind").asString();
        String instanceId = source.path("instanceId").isString()
                ? source.path("instanceId").asString() : null;
        Object value;
        try {
            value = mapper.readValue(propertyValue.data(), Object.class);
        } catch (JacksonException exception) {
            throw new IllegalStateException(exception);
        }
        properties.computeIfAbsent(owner, ignored -> new LinkedHashMap<>())
                .computeIfAbsent(key, ignored -> new ArrayList<>())
                .add(new Source(kind, instanceId, null, tier, value,
                        observedAt.toInstant().toString(), setBy));
    }

    private boolean meetsConditions(List<PropertyCondition> conditions, Iteration iteration,
            Map<String, String> about, Map<String, List<PropertyValues>> documentProperties,
            Map<String, List<PropertyValues>> iterationProperties, String today) {
        for (PropertyCondition condition : conditions) {
            String propertyAbout = about.get(condition.key());
            if (propertyAbout == null) {
                continue;
            }
            boolean isDocument = propertyAbout.equals("document");
            String owner = isDocument ? iteration.documentId() : iteration.id();
            List<PropertyValues> properties = (isDocument ? documentProperties : iterationProperties)
                    .getOrDefault(owner, List.of());
            PropertyValues values = Properties.valuesOf(properties, condition.key());
            Source inUse = values == null ? null : iteration.digitizedAt() == null
                    ? Properties.valueInUseOf(values.sources())
                    : Properties.valueInUseAt(values.sources(), iteration.digitizedAt());
            if (!Properties.meetsCondition(condition, inUse == null ? null : inUse.value(), today)) {
                return false;
            }
        }
        return true;
    }

    private static String instant(OffsetDateTime value) {
        return value == null ? null : value.toInstant().toString();
    }

    public record CountingSnapshot(List<StoredIntention> intentions, List<StoredMix> mixes,
            CountingData rules, Function<Iteration, Integer> pagesOf) {}

    public record StoredIntention(Intention rule, String name, String projectId,
            String distributionId, Integer mixRevision) {}

    public record StoredMix(String id, String name, Map<String, Double> shares, int revision,
            String archivedAt, List<StoredRevision> revisions) {}

    public record StoredRevision(int revision, Map<String, Double> shares, String at, String label) {}

    public record StoredDistribution(String id, String name, int revision, Distribution countingShares) {}
}
