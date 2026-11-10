package cz.mzk.vera.requests;

import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODIES;
import static cz.mzk.vera.db.tables.Tables.REQUEST_PLACEMENTS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;

import cz.mzk.vera.plugin.custody.Custody;
import cz.mzk.vera.plugin.custody.PlaceAnswer;
import cz.mzk.vera.plugin.custody.PlaceInput;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginInstances;
import cz.mzk.vera.pluginhost.PluginOutcome;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jooq.DSLContext;
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
        apply(dsl, requestId, preview(dsl, requestId));
    }

    public Placement preview(DSLContext dsl, String requestId) {
        RequestPluginInput input = RequestPluginInput.read(dsl, requestId);
        Set<String> accepted = new LinkedHashSet<>();
        Set<String> knownCustodies = new HashSet<>(dsl.select(REQUEST_CUSTODIES.ID)
                .from(REQUEST_CUSTODIES).fetch(REQUEST_CUSTODIES.ID));
        List<PluginInstances.Instance> custodians = instances.enabled(dsl, "Custody");
        for (PluginInstances.Instance instance : custodians) {
            PluginOutcome<PlaceAnswer> outcome = calls.call(dsl, instance.id(), Custody.class, "place",
                    (plugin, context) -> plugin.place(context, new PlaceInput(input.request(), input.document())));
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
        return new Placement(List.copyOf(accepted));
    }

    public void apply(DSLContext dsl, String requestId, Placement placement) {
        dsl.deleteFrom(REQUEST_PLACEMENTS).where(REQUEST_PLACEMENTS.REQUEST_ID.eq(requestId)).execute();
        int position = 0;
        for (String custodyId : placement.custodyIds()) {
            dsl.insertInto(REQUEST_PLACEMENTS)
                    .set(REQUEST_PLACEMENTS.REQUEST_ID, requestId)
                    .set(REQUEST_PLACEMENTS.CUSTODY_ID, custodyId)
                    .set(REQUEST_PLACEMENTS.POSITION, position++)
                    .execute();
        }
    }

    public record Placement(List<String> custodyIds) { }
}
