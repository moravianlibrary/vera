package cz.mzk.vera.requests;

import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODIES;
import static cz.mzk.vera.db.tables.Tables.REQUEST_PLACEMENTS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;

import cz.mzk.vera.plugin.custody.Custody;
import cz.mzk.vera.plugin.custody.PlaceAnswer;
import cz.mzk.vera.plugin.custody.PlaceInput;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.records.Request;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginInstances;
import cz.mzk.vera.pluginhost.PluginOutcome;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

// BK3 Choices; ACCESS-custody-by-plugins; PLG-api-kinds. Keeps the ordered union of custody answers.
@Component
public class RequestPlacements {
    private static final Logger LOGGER = LoggerFactory.getLogger(RequestPlacements.class);

    private final PluginInstances instances;
    private final PluginCalls calls;

    public RequestPlacements(PluginInstances instances, PluginCalls calls) {
        this.instances = instances;
        this.calls = calls;
    }

    public void place(DSLContext dsl, String requestId) {
        Record row = dsl.select(REQUESTS.ID, REQUESTS.DOCUMENT_ID, REQUESTS.REQUESTER_ID,
                        REQUESTS.AT, REQUESTS.REASON, REQUESTS.BATCH_ID, REQUESTS.PROJECT_ID,
                        REQUESTS.CHECKED_AT, REQUESTS.DECISION,
                        DOCUMENTS.ID, DOCUMENTS.CATALOG_ID, DOCUMENTS.UNIT_TYPE,
                        DOCUMENTS.UNIT_VALUE, DOCUMENTS.TITLE, DOCUMENTS.TYPE, DOCUMENTS.SHELF_MARK)
                .from(REQUESTS.join(DOCUMENTS).on(REQUESTS.DOCUMENT_ID.eq(DOCUMENTS.ID)))
                .where(REQUESTS.ID.eq(requestId))
                .fetchOne();
        if (row == null) {
            throw new IllegalArgumentException("Unknown request " + requestId);
        }
        Document.Unit unit = row.get(DOCUMENTS.UNIT_TYPE) == null ? null
                : new Document.Unit(row.get(DOCUMENTS.UNIT_TYPE), row.get(DOCUMENTS.UNIT_VALUE));
        Document document = new Document(row.get(DOCUMENTS.ID), row.get(DOCUMENTS.CATALOG_ID), unit,
                row.get(DOCUMENTS.TITLE), row.get(DOCUMENTS.TYPE), row.get(DOCUMENTS.SHELF_MARK));
        Request request = new Request(row.get(REQUESTS.ID), row.get(REQUESTS.DOCUMENT_ID),
                row.get(REQUESTS.REQUESTER_ID), row.get(REQUESTS.AT).toInstant(), row.get(REQUESTS.REASON),
                row.get(REQUESTS.BATCH_ID), row.get(REQUESTS.PROJECT_ID),
                row.get(REQUESTS.CHECKED_AT) == null ? null : row.get(REQUESTS.CHECKED_AT).toInstant(),
                row.get(REQUESTS.DECISION));
        Set<String> accepted = new LinkedHashSet<>();
        Set<String> knownCustodies = new HashSet<>(dsl.select(REQUEST_CUSTODIES.ID)
                .from(REQUEST_CUSTODIES).fetch(REQUEST_CUSTODIES.ID));
        List<PluginInstances.Instance> custodians = instances.enabled(dsl, "Custody");
        for (PluginInstances.Instance instance : custodians) {
            PluginOutcome<PlaceAnswer> outcome = calls.call(dsl, instance.id(), Custody.class, "place",
                    (plugin, context) -> plugin.place(context, new PlaceInput(request, document)));
            if (outcome instanceof PluginOutcome.Answered<PlaceAnswer> answered) {
                for (String custodyId : answered.answer().custodies()) {
                    if (knownCustodies.contains(custodyId)) {
                        accepted.add(custodyId);
                    } else {
                        LOGGER.warn("Custody plugin named unknown custody instance={} request={} custody={}",
                                instance.id(), requestId, custodyId);
                    }
                }
            } else {
                LOGGER.warn("Custody plugin did not place request instance={} request={} outcome={}",
                        instance.id(), requestId, outcome.getClass().getSimpleName());
            }
        }
        dsl.deleteFrom(REQUEST_PLACEMENTS).where(REQUEST_PLACEMENTS.REQUEST_ID.eq(requestId)).execute();
        int position = 0;
        for (String custodyId : accepted) {
            dsl.insertInto(REQUEST_PLACEMENTS)
                    .set(REQUEST_PLACEMENTS.REQUEST_ID, requestId)
                    .set(REQUEST_PLACEMENTS.CUSTODY_ID, custodyId)
                    .set(REQUEST_PLACEMENTS.POSITION, position++)
                    .execute();
        }
    }
}
