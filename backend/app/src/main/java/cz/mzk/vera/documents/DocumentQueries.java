package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_VALUES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_STATES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;

import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.listing.Listing;
import cz.mzk.vera.listing.FacetSource;
import cz.mzk.vera.listing.Facets;
import cz.mzk.vera.listing.ListQuery;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.SortField;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

// VIEW-documents-audience: read one detail through the shared reach and record projections.
@Repository
public class DocumentQueries {
    private final DSLContext dsl;
    private final HeldAccessQueries heldAccess;
    private final DocumentReach reach;
    private final DocumentRecords records;
    private final DocumentRedaction redaction;
    private final DocumentHistory history;
    private final ListQuery listQuery;
    private final Facets facetQueries;
    private final DocumentGrouping grouping;
    private final Clock clock;
    private final PropertyDefinitions propertyDefinitions;

    public DocumentQueries(DSLContext dsl, HeldAccessQueries heldAccess, DocumentReach reach,
            DocumentRecords records, DocumentRedaction redaction, DocumentHistory history,
            ListQuery listQuery, Facets facetQueries, DocumentGrouping grouping, Clock clock,
            PropertyDefinitions propertyDefinitions) {
        this.dsl = dsl;
        this.heldAccess = heldAccess;
        this.reach = reach;
        this.records = records;
        this.redaction = redaction;
        this.history = history;
        this.listQuery = listQuery;
        this.facetQueries = facetQueries;
        this.grouping = grouping;
        this.clock = clock;
        this.propertyDefinitions = propertyDefinitions;
    }

    public Map<String, Object> page(Map<String, String> parameters, String callerId, boolean mine) {
        HeldScopes held = heldAccess.scopesHeldBy(callerId);
        Audience audience = mine ? Audience.PUBLIC : audienceOf(held);
        List<PropertyDefinitions.Definition> definitions = propertyDefinitions.filterable(dsl, audience);
        DocumentSearch search = DocumentSearch.parse(parameters, definitions);
        List<Category> categories = dsl.selectFrom(CATEGORIES)
            .fetch(row -> new Category(row.getId(), row.getParentId()));
        Condition documentReach = reach.condition(held, callerId, audience);
        LocalDate today = LocalDate.now(clock);
        Condition filters = filters(search, audience, callerId, categories, null, held, today);
        DocumentSearch.Grouping effective = grouping.effective(search, audience, held);
        DocumentGrouping.Arrangement arrangement = grouping.arrange(effective, documentReach);
        List<String> orderedIds = orderedIds(audience, arrangement.rank(), callerId, held,
            documentReach, filters);
        Listing.Slice slice = Listing.sliceOf(orderedIds, search.cursor(), search.limit());
        List<Map<String, Object>> items = items(slice, held, callerId, audience);
        Map<String, Object> facets = facets(search, audience, callerId, categories, held,
            documentReach, today);
        Map<String, Object> propertyFacets = propertyFacets(definitions, search, audience,
            callerId, categories, held, documentReach, today);
        return pageResult(audience, items, orderedIds, slice, arrangement, facets, propertyFacets);
    }

    private List<String> orderedIds(Audience audience, Field<Integer> rank, String callerId,
            HeldScopes held, Condition documentReach, Condition filters) {
        List<SortField<?>> order = orderedBy(audience, rank, callerId, held);
        var query = dsl.select(DOCUMENTS.ID).from(DOCUMENTS
                .leftJoin(DOCUMENT_STATES).on(DOCUMENT_STATES.DOCUMENT_ID.eq(DOCUMENTS.ID))
                .leftJoin(ITERATIONS).on(ITERATIONS.ID.eq(DOCUMENT_STATES.CURRENT_ITERATION_ID)))
            .where(documentReach.and(filters)).orderBy(order);
        return listQuery.ids(query);
    }

    private List<Map<String, Object>> items(Listing.Slice slice, HeldScopes held,
            String callerId, Audience audience) {
        Map<String, Map<String, Object>> pageRecords = records.recordsOf(slice.items());
        List<Map<String, Object>> items = new ArrayList<>();
        for (String id : slice.items()) {
            items.add(redaction.redact(pageRecords.get(id), held, callerId, id, audience));
        }
        return items;
    }

    private Map<String, Object> facets(DocumentSearch search, Audience audience, String callerId,
            List<Category> categories, HeldScopes held, Condition documentReach, LocalDate today) {
        Map<String, Object> facets = new LinkedHashMap<>();
        for (DocumentField field : DocumentField.values()) {
            if (!field.hasFacet()) {
                continue;
            }
            if (!field.isAvailableTo(audience)) {
                facets.put(field.facetName(), List.of());
                continue;
            }
            var matching = dsl.select(DOCUMENTS.ID, DOCUMENTS.POSITION).from(DOCUMENTS)
                .where(documentReach.and(filters(search, audience, callerId, categories,
                    field.facetName(), held, today)));
            facets.put(field.facetName(), facetQueries.count(
                field.facetSource(dsl, callerId, categories, held), matching, false).values());
        }
        return facets;
    }

    private Map<String, Object> propertyFacets(List<PropertyDefinitions.Definition> definitions,
            DocumentSearch search, Audience audience, String callerId, List<Category> categories,
            HeldScopes held, Condition documentReach, LocalDate today) {
        Map<String, Object> propertyFacets = new LinkedHashMap<>();
        for (PropertyDefinitions.Definition definition : definitions) {
            if (definition.type() != PropertyType.ENUM && definition.type() != PropertyType.YES_NO) {
                continue;
            }
            var source = propertyFacetSource(definition);
            var matching = dsl.select(DOCUMENTS.ID, DOCUMENTS.POSITION).from(DOCUMENTS)
                .where(documentReach.and(filters(search, audience, callerId, categories,
                    DocumentField.PROPERTIES.queryName() + definition.key(), held, today)));
            Facets.Count count = facetQueries.count(source, matching, true);
            Map<String, Object> facet = new LinkedHashMap<>();
            facet.put("values", count.values());
            facet.put("noValue", count.noValue());
            propertyFacets.put(definition.key(), facet);
        }
        return propertyFacets;
    }

    public List<String> requestPropertyKeys(HeldScopes held) {
        return requestPropertyDefinitions(held).stream().map(PropertyDefinitions.Definition::key).toList();
    }

    public Condition requestPropertyCondition(Map<String, String> parameters, HeldScopes held,
            String except, LocalDate today) {
        List<PropertyDefinitions.Definition> definitions = requestPropertyDefinitions(held);
        DocumentSearch search = DocumentSearch.parse(parameters, definitions);
        return DocumentField.PROPERTIES.propertyConditions(search.properties(), today, except);
    }

    public Map<String, FacetSource> requestPropertyFacetSources(HeldScopes held) {
        Map<String, FacetSource> sources = new LinkedHashMap<>();
        for (PropertyDefinitions.Definition definition : requestPropertyDefinitions(held)) {
            if (definition.type() == PropertyType.ENUM || definition.type() == PropertyType.YES_NO) {
                sources.put(definition.key(), propertyFacetSource(definition));
            }
        }
        return sources;
    }

    private List<PropertyDefinitions.Definition> requestPropertyDefinitions(HeldScopes held) {
        return propertyDefinitions.filterable(dsl, Audience.STAFF).stream()
            .filter(definition -> !definition.key().equals("material_type"))
            .filter(definition -> held.hasPermission(DocumentCodes.ITERATION_READ)
                || definition.visibility() == PropertyVisibility.PUBLIC)
            .toList();
    }

    private FacetSource propertyFacetSource(PropertyDefinitions.Definition definition) {
        return new FacetSource(definition.key(),
            dsl.select(DOCUMENT_PROPERTY_VALUES.DOCUMENT_ID, DOCUMENT_PROPERTY_VALUES.TEXT_VALUE,
                DOCUMENT_PROPERTY_VALUES.ORDINAL)
                .from(DOCUMENT_PROPERTY_VALUES)
                .where(DOCUMENT_PROPERTY_VALUES.KEY.eq(definition.key())), definition.key());
    }

    private Map<String, Object> pageResult(Audience audience, List<Map<String, Object>> items,
            List<String> orderedIds, Listing.Slice slice, DocumentGrouping.Arrangement arrangement,
            Map<String, Object> facets, Map<String, Object> propertyFacets) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("audience", audience.wireName());
        result.put("items", items);
        result.put("total", orderedIds.size());
        result.put("nextCursor", slice.nextCursor());
        result.put("groups", arrangement.headersOf(slice.items(), orderedIds));
        result.put("facets", facets);
        result.put("propertyFacets", propertyFacets);
        return result;
    }

    private List<SortField<?>> orderedBy(Audience audience, Field<Integer> rank,
            String callerId, HeldScopes held) {
        List<SortField<?>> order = new ArrayList<>();
        if (rank != null) {
            order.add(rank.asc());
        }
        if (audience == Audience.STAFF) {
            order.add(DocumentOrder.priority());
            order.add(DocumentOrder.activity());
        } else {
            order.add(DocumentOrder.ownLatestAsk(callerId, held));
        }
        order.add(DOCUMENTS.POSITION.asc());
        return order;
    }

    private Condition filters(DocumentSearch search, Audience audience, String callerId,
            List<Category> categories, String except, HeldScopes held, LocalDate today) {
        Condition result = DSL.noCondition();
        for (DocumentField field : DocumentField.values()) {
            if (field.isAvailableTo(audience)) {
                result = result.and(field.filterCondition(dsl, search, callerId, categories,
                    today, except, held));
            }
        }
        return result;
    }

    public Map<String, Object> detail(String documentId, String callerId, boolean mine) {
        HeldScopes held = heldAccess.scopesHeldBy(callerId);
        Audience audience = mine ? Audience.PUBLIC : audienceOf(held);
        if (dsl.select(DOCUMENTS.ID).from(DOCUMENTS).where(DOCUMENTS.ID.eq(documentId)
                .and(reach.condition(held, callerId, audience))).fetchOne() == null) {
            return null;
        }
        Map<String, Object> record = records.recordsOf(List.of(documentId)).get(documentId);
        redaction.redact(record, held, callerId, documentId, audience);
        Set<String> subjects = new LinkedHashSet<>();
        subjects.add(documentId);
        addSubjects(subjects, record, "iterations");
        addSubjects(subjects, record, "requests");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("audience", audience.wireName());
        result.put("record", record);
        result.put("log", history.logOf(subjects, held, audience));
        return result;
    }

    public boolean canOpenMyDocuments(String callerId) {
        return heldAccess.scopesHeldBy(callerId).hasPermission(DocumentCodes.REQUEST_READ_MINE);
    }

    public Audience audienceOf(String callerId) {
        return audienceOf(heldAccess.scopesHeldBy(callerId));
    }

    private Audience audienceOf(HeldScopes held) {
        return held.hasPermission(DocumentCodes.ITERATION_READ) ? Audience.STAFF : Audience.PUBLIC;
    }

    @SuppressWarnings("unchecked")
    private void addSubjects(Set<String> subjects, Map<String, Object> record, String key) {
        ((List<Map<String, Object>>) record.get(key)).forEach(row -> subjects.add((String) row.get("id")));
    }
}
