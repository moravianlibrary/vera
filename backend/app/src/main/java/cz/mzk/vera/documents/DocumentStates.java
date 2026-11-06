package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PAGE_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_VALUES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_REGISTRY_RECORDS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_STATES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_DEFECTS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.ITERATION_STATES;
import static cz.mzk.vera.db.tables.Tables.ITERATION_VERDICTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES;
import static cz.mzk.vera.db.tables.Tables.REQUEST_STATES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static org.jooq.impl.DSL.excluded;

import cz.mzk.vera.domain.documents.Documents;
import cz.mzk.vera.domain.entities.Cancellation;
import cz.mzk.vera.domain.entities.CancellationCause;
import cz.mzk.vera.domain.entities.Decision;
import cz.mzk.vera.domain.entities.Defect;
import cz.mzk.vera.domain.entities.Document;
import cz.mzk.vera.domain.entities.DocumentRecord;
import cz.mzk.vera.domain.entities.ExistingCopy;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.IterationLink;
import cz.mzk.vera.domain.entities.PageSource;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.entities.RegistryRecord;
import cz.mzk.vera.domain.entities.RegistryState;
import cz.mzk.vera.domain.entities.Relation;
import cz.mzk.vera.domain.entities.Request;
import cz.mzk.vera.domain.entities.Restriction;
import cz.mzk.vera.domain.entities.RestrictionOverride;
import cz.mzk.vera.domain.entities.Verdict;
import cz.mzk.vera.domain.entities.VerdictKind;
import cz.mzk.vera.domain.status.Status;
import cz.mzk.vera.db.tables.tables.records.DocumentsRecord;
import cz.mzk.vera.db.tables.tables.records.IterationsRecord;
import cz.mzk.vera.db.tables.tables.records.RequestsRecord;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.UpdatableRecord;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// VIEW-documents; VIEW-requests; STAT-validation; STAT-public. Stores the derived list values.
@Component
public class DocumentStates {
    private final JsonMapper mapper;
    private final DocumentJson json;
    private final PropertyDefinitions propertyDefinitions;

    public DocumentStates(JsonMapper mapper, DocumentJson json, PropertyDefinitions propertyDefinitions) {
        this.mapper = mapper;
        this.json = json;
        this.propertyDefinitions = propertyDefinitions;
    }

    public void recompute(DSLContext dsl, String documentId) {
        DocumentsRecord documentRow = dsl.selectFrom(DOCUMENTS)
                .where(DOCUMENTS.ID.eq(documentId))
                .fetchOne();
        if (documentRow == null) {
            throw new IllegalArgumentException("Unknown document " + documentId);
        }

        List<PageSource> pageSources = dsl.selectFrom(DOCUMENT_PAGE_SOURCES)
                .where(DOCUMENT_PAGE_SOURCES.DOCUMENT_ID.eq(documentId))
                .orderBy(DOCUMENT_PAGE_SOURCES.POSITION)
                .fetch(row -> new PageSource(row.getSource(), row.getTier(), row.getValue()));
        List<RegistryRecord> registryRecords = dsl.selectFrom(DOCUMENT_REGISTRY_RECORDS)
                .where(DOCUMENT_REGISTRY_RECORDS.DOCUMENT_ID.eq(documentId))
                .orderBy(DOCUMENT_REGISTRY_RECORDS.POSITION)
                .fetch(row -> new RegistryRecord(row.getRegistry(), RegistryState.valueOf(row.getState())));
        Document document = new Document(documentId, documentRow.getCatalogId(), documentRow.getUnitValue(),
                pageSources, registryRecords);

        List<Iteration> iterations = dsl.selectFrom(ITERATIONS)
                .where(ITERATIONS.DOCUMENT_ID.eq(documentId))
                .orderBy(ITERATIONS.ATTEMPT)
                .fetch(row -> iteration(dsl, row));
        List<Request> requests = dsl.selectFrom(REQUESTS)
                .where(REQUESTS.DOCUMENT_ID.eq(documentId))
                .orderBy(REQUESTS.AT)
                .fetch(row -> request(dsl, row));
        DocumentRecord record = new DocumentRecord(document, iterations, requests);

        storePropertyValues(dsl, documentId, documentRow, record);

        Iteration current = Documents.currentIterationOf(record);
        PageSource pageCount = Documents.effectivePageCount(document);
        String currentIterationId = current == null ? null : current.id();
        String projectId = Documents.projectIdOf(record);
        String batchId = Documents.batchIdOf(record);
        Documents.AdditionState additionState = Documents.additionStateOf(record);
        String additionStateValue = additionState == null ? null : additionState.wireName();
        Integer pageCountValue = pageCount == null ? null : pageCount.value();
        String existingCopyState = Documents.existingCopyStateOf(document).name();
        dsl.insertInto(DOCUMENT_STATES)
                .set(DOCUMENT_STATES.DOCUMENT_ID, documentId)
                .set(DOCUMENT_STATES.CURRENT_ITERATION_ID, currentIterationId)
                .set(DOCUMENT_STATES.PROJECT_ID, projectId)
                .set(DOCUMENT_STATES.BATCH_ID, batchId)
                .set(DOCUMENT_STATES.ADDITION_STATE, additionStateValue)
                .set(DOCUMENT_STATES.PAGE_COUNT, pageCountValue)
                .set(DOCUMENT_STATES.EXISTING_COPY_STATE, existingCopyState)
                .onConflict(DOCUMENT_STATES.DOCUMENT_ID)
                .doUpdate()
                .set(DOCUMENT_STATES.CURRENT_ITERATION_ID, excluded(DOCUMENT_STATES.CURRENT_ITERATION_ID))
                .set(DOCUMENT_STATES.PROJECT_ID, excluded(DOCUMENT_STATES.PROJECT_ID))
                .set(DOCUMENT_STATES.BATCH_ID, excluded(DOCUMENT_STATES.BATCH_ID))
                .set(DOCUMENT_STATES.ADDITION_STATE, excluded(DOCUMENT_STATES.ADDITION_STATE))
                .set(DOCUMENT_STATES.PAGE_COUNT, excluded(DOCUMENT_STATES.PAGE_COUNT))
                .set(DOCUMENT_STATES.EXISTING_COPY_STATE, excluded(DOCUMENT_STATES.EXISTING_COPY_STATE))
                .execute();

        for (Iteration iteration : iterations) {
            Status.DisplayStatus iterationStatus = Status.iterationStatusOf(iteration);
            Status.Validation validation = Status.validationOf(iteration);
            boolean isRestricted = Status.isRestricted(iteration);
            dsl.insertInto(ITERATION_STATES)
                    .set(ITERATION_STATES.ITERATION_ID, iteration.id())
                    .set(ITERATION_STATES.DOCUMENT_ID, documentId)
                    .set(ITERATION_STATES.STATUS, iterationStatus.name())
                    .set(ITERATION_STATES.VALIDATION, validation.name())
                    .set(ITERATION_STATES.IS_RESTRICTED, isRestricted)
                    .onConflict(ITERATION_STATES.ITERATION_ID)
                    .doUpdate()
                    .set(ITERATION_STATES.DOCUMENT_ID, excluded(ITERATION_STATES.DOCUMENT_ID))
                    .set(ITERATION_STATES.STATUS, excluded(ITERATION_STATES.STATUS))
                    .set(ITERATION_STATES.VALIDATION, excluded(ITERATION_STATES.VALIDATION))
                    .set(ITERATION_STATES.IS_RESTRICTED, excluded(ITERATION_STATES.IS_RESTRICTED))
                    .execute();
        }

        List<Request> askers = Documents.askersOf(record);
        for (Request request : requests) {
            String followedId = Documents.followedIterationId(request);
            Iteration followed = followedId == null ? null : Documents.iterationOf(record, followedId);
            Status.PublicStatus publicStatus = Status.publicStatusOf(request, followed);
            boolean isAsker = askers.contains(request);
            dsl.insertInto(REQUEST_STATES)
                    .set(REQUEST_STATES.REQUEST_ID, request.id())
                    .set(REQUEST_STATES.DOCUMENT_ID, documentId)
                    .set(REQUEST_STATES.PUBLIC_STATUS, publicStatus.name())
                    .set(REQUEST_STATES.IS_ASKER, isAsker)
                    .onConflict(REQUEST_STATES.REQUEST_ID)
                    .doUpdate()
                    .set(REQUEST_STATES.DOCUMENT_ID, excluded(REQUEST_STATES.DOCUMENT_ID))
                    .set(REQUEST_STATES.PUBLIC_STATUS, excluded(REQUEST_STATES.PUBLIC_STATUS))
                    .set(REQUEST_STATES.IS_ASKER, excluded(REQUEST_STATES.IS_ASKER))
                    .execute();
        }
    }

    private void storePropertyValues(DSLContext dsl, String documentId, DocumentsRecord documentRow,
            DocumentRecord record) {
        Iteration current = Documents.currentIterationOf(record);
        String currentId = current == null ? null : current.id();
        dsl.deleteFrom(DOCUMENT_PROPERTY_VALUES)
            .where(DOCUMENT_PROPERTY_VALUES.DOCUMENT_ID.eq(documentId))
            .execute();

        Map<String, PropertyValueInUse> documentValues = new LinkedHashMap<>();
        Map<String, PropertyValueInUse> iterationValues = new LinkedHashMap<>();
        dsl.select(DOCUMENT_PROPERTY_SOURCES.KEY, DOCUMENT_PROPERTY_SOURCES.TIER,
                DOCUMENT_PROPERTY_SOURCES.VALUE)
            .from(DOCUMENT_PROPERTY_SOURCES)
            .where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq(documentId))
            .orderBy(DOCUMENT_PROPERTY_SOURCES.POSITION)
            .fetch()
            .forEach(row -> selectValue(documentValues, row.get(DOCUMENT_PROPERTY_SOURCES.KEY),
                row.get(DOCUMENT_PROPERTY_SOURCES.TIER), row.get(DOCUMENT_PROPERTY_SOURCES.VALUE)));
        if (currentId != null) {
            dsl.select(ITERATION_PROPERTY_SOURCES.KEY, ITERATION_PROPERTY_SOURCES.TIER,
                    ITERATION_PROPERTY_SOURCES.VALUE)
                .from(ITERATION_PROPERTY_SOURCES)
                .where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq(currentId))
                .orderBy(ITERATION_PROPERTY_SOURCES.POSITION)
                .fetch()
                .forEach(row -> selectValue(iterationValues, row.get(ITERATION_PROPERTY_SOURCES.KEY),
                    row.get(ITERATION_PROPERTY_SOURCES.TIER), row.get(ITERATION_PROPERTY_SOURCES.VALUE)));
        }

        List<UpdatableRecord<?>> rows = new ArrayList<>();
        for (PropertyDefinitions.Definition definition : propertyDefinitions.all(dsl)) {
            String key = definition.key();
            PropertyKey propertyKey = PropertyKey.of(key);
            if (propertyKey == PropertyKey.PAGE_COUNT) {
                continue;
            }
            JsonNode value = switch (propertyKey) {
                case MATERIAL_TYPE -> mapper.valueToTree(documentRow.getType());
                case SHELF_MARK -> documentRow.getShelfMark() == null
                    ? null : mapper.valueToTree(documentRow.getShelfMark());
                case TITLE -> mapper.valueToTree(documentRow.getTitle());
                case PAGE_COUNT -> null;
                case null -> valueFor(key, definition.about(), documentValues, iterationValues);
            };
            if (value == null) {
                continue;
            }
            List<JsonNode> scalars;
            if (value.isArray()) {
                List<JsonNode> values = new ArrayList<>();
                value.forEach(values::add);
                scalars = values;
            } else {
                scalars = List.of(value);
            }
            int ordinal = 0;
            for (JsonNode scalar : scalars) {
                String text;
                if (scalar.isBoolean()) {
                    text = scalar.booleanValue() ? "Yes" : "No";
                } else {
                    text = scalar.isString() ? scalar.asString() : scalar.toString();
                }
                BigDecimal number = definition.type() == PropertyType.NUMBER
                    && scalar.isNumber() ? scalar.decimalValue() : null;
                var row = dsl.newRecord(DOCUMENT_PROPERTY_VALUES);
                row.setDocumentId(documentId);
                row.setKey(key);
                row.setOrdinal(ordinal++);
                row.setTextValue(text);
                row.setNumberValue(number);
                rows.add(row);
            }
        }
        if (!rows.isEmpty()) {
            dsl.batchInsert(rows).execute();
        }
    }

    private void selectValue(Map<String, PropertyValueInUse> values, String key, int tier, JSONB value) {
        PropertyValueInUse previous = values.get(key);
        if (previous == null || tier > previous.tier()) {
            // Stable descending tier order keeps the first source in position on an equal tier.
            values.put(key, new PropertyValueInUse(tier, json.read(value)));
        }
    }

    private JsonNode valueFor(String key, PropertyAbout about,
            Map<String, PropertyValueInUse> documentValues,
            Map<String, PropertyValueInUse> iterationValues) {
        Map<String, PropertyValueInUse> values = about == PropertyAbout.DOCUMENT
            ? documentValues : iterationValues;
        PropertyValueInUse value = values.get(key);
        return value == null ? null : value.value();
    }

    private record PropertyValueInUse(int tier, JsonNode value) {}

    private Iteration iteration(DSLContext dsl, IterationsRecord row) {
        String id = row.getId();
        List<Defect> defects = dsl.selectFrom(ITERATION_DEFECTS)
                .where(ITERATION_DEFECTS.ITERATION_ID.eq(id))
                .orderBy(ITERATION_DEFECTS.POSITION)
                .fetch(value -> new Defect(value.getKey()));
        List<Verdict> verdicts = dsl.selectFrom(ITERATION_VERDICTS)
                .where(ITERATION_VERDICTS.ITERATION_ID.eq(id))
                .orderBy(ITERATION_VERDICTS.POSITION)
                .fetch(value -> new Verdict(Arrays.asList(value.getDefectKeys()),
                        VerdictKind.valueOf(value.getVerdict())));
        Progress progress = Progress.valueOf(row.getProgress());
        Restriction restriction = row.getRestrictionRule() == null ? null
                : new Restriction(row.getRestrictionRule());
        RestrictionOverride override = row.getOverrideNote() == null ? null
                : new RestrictionOverride(row.getOverrideNote());
        Cancellation cancellation = row.getCancellationCause() == null ? null
                : new Cancellation(CancellationCause.valueOf(row.getCancellationCause()));
        return new Iteration(id, row.getDocumentId(), row.getAttempt(), row.getRequestId(),
                row.getCategoryId(), row.getProjectId(), progress, restriction, override, cancellation,
                defects, verdicts);
    }

    private Request request(DSLContext dsl, RequestsRecord row) {
        String id = row.getId();
        List<ExistingCopy> copies = dsl.selectFrom(REQUEST_EXISTING_COPIES)
                .where(REQUEST_EXISTING_COPIES.REQUEST_ID.eq(id))
                .orderBy(REQUEST_EXISTING_COPIES.POSITION)
                .fetch(value -> new ExistingCopy(value.getSource(), RegistryState.valueOf(value.getState()),
                        value.getLink(), value.getIterationId()));
        String relation = row.getIterationRelation();
        String iterationId = row.getIterationId();
        IterationLink iteration = relation == null ? null
                : new IterationLink(Relation.valueOf(relation), iterationId);
        return new Request(id, row.getDocumentId(), row.getRequesterId(), instant(row.getAt()),
                row.getReason(), row.getBatchId(), row.getProjectId(),
                Decision.valueOf(row.getDecision()), iteration,
                row.getTracksIterationId(), copies, instant(row.getCheckedAt()),
                Boolean.TRUE.equals(row.getIsAfterProjectApproval()));
    }

    private String instant(OffsetDateTime value) {
        return value == null ? null : value.toInstant().toString();
    }
}
