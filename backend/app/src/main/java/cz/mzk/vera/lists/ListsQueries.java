package cz.mzk.vera.lists;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.DIGITIZATION_LISTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_VALUES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_STATES;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.ITERATION_STATES;
import static cz.mzk.vera.db.tables.Tables.PROJECTS;
import static cz.mzk.vera.db.tables.Tables.PROPERTY_DEFINITIONS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static org.jooq.impl.DSL.countDistinct;
import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.sum;

import cz.mzk.vera.documents.DocumentHistory;
import cz.mzk.vera.documents.DocumentQueries;
import cz.mzk.vera.documents.DocumentRecords;
import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.entities.DigitizationList;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.intentions.Intentions;
import cz.mzk.vera.domain.lists.Lists;
import cz.mzk.vera.domain.listing.Listing;
import cz.mzk.vera.domain.properties.Properties;
import cz.mzk.vera.domain.valuerange.DayRange;
import cz.mzk.vera.domain.valuerange.Range;
import cz.mzk.vera.domain.valuerange.ValueRange;
import cz.mzk.vera.intentions.CountingReads;
import cz.mzk.vera.intentions.CountingReads.CountingSnapshot;
import cz.mzk.vera.intentions.CountingReads.StoredIntention;
import cz.mzk.vera.listing.FacetSource;
import cz.mzk.vera.listing.Facets;
import cz.mzk.vera.db.tables.tables.records.DigitizationListsRecord;
import cz.mzk.vera.db.tables.tables.records.IterationsRecord;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import cz.mzk.vera.web.Instants;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.JSONB;
import org.jooq.Record3;
import org.jooq.Select;
import org.jooq.SortField;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

// VIEW-lists; SCOPE-list; LC-LIST-state; LC-LIST-pool.
@Repository
public class ListsQueries {
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final JsonMapper mapper;
    private final ListIndexQueries index;
    private final PoolQueries pool;
    private final ListDetailQueries detail;

    ListsQueries(DSLContext dsl, HeldAccessQueries access, JsonMapper mapper, ListIndexQueries index,
            PoolQueries pool, ListDetailQueries detail) {
        this.dsl = dsl;
        this.access = access;
        this.mapper = mapper;
        this.index = index;
        this.pool = pool;
        this.detail = detail;
    }

    boolean canRead(String userId) {
        return access.scopesHeldBy(userId).hasPermission("list.read");
    }

    boolean canBuild(String userId) {
        HeldScopes held = access.scopesHeldBy(userId);
        return held.hasPermission("list.create") || held.hasPermission("list.edit");
    }

    List<Map<String, Object>> lists() {
        List<Map<String, Object>> result = new ArrayList<>();
        dsl.selectFrom(DIGITIZATION_LISTS).orderBy(DIGITIZATION_LISTS.POSITION).fetch().forEach(row -> {
            Map<String, Object> done = row.getDoneAt() == null ? null : ListQuerySupport.map(
                    "actorId", row.getDoneActorId(), "at", Instants.format(row.getDoneAt().toInstant()));
            result.add(ListQuerySupport.map("id", row.getId(), "name", row.getName(),
                    "startsOn", row.getStartsOn().toString(),
                    "endsOn", row.getEndsOn().toString(), "targetPages", row.getTargetPages(),
                    "generated", readJson(row.getGenerated()), "createdBy", row.getCreatedBy(),
                    "createdAt", Instants.format(row.getCreatedAt().toInstant()), "done", done));
        });
        return result;
    }

    public Map<String, Object> index(Map<String, String> parameters, String userId) {
        return index.index(parameters, userId);
    }

    public boolean matchesForHook(Map<String, String> parameters, String listId) {
        return index.matchesForHook(parameters, listId);
    }

    Map<String, Object> pool(Map<String, String> parameters, String userId) {
        return pool.pool(parameters, userId);
    }

    Map<String, Object> detail(String listId, String userId) {
        return detail.detail(listId, userId);
    }

    private Object readJson(JSONB value) {
        if (value == null) {
            return null;
        }
        try {
            return mapper.readValue(value.data(), Object.class);
        } catch (JacksonException exception) {
            throw new IllegalStateException(exception);
        }
    }

}
