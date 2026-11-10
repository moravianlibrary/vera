package cz.mzk.vera.tasks;

import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_CURSORS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.USERS;

import cz.mzk.vera.plugin.harvester.HarvestAnswer;
import cz.mzk.vera.plugin.harvester.HarvestInput;
import cz.mzk.vera.plugin.harvester.Harvester;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
import cz.mzk.vera.proposals.ProposalSubmit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// PLG-run-items; harvested proposals use the declared agent as their actor.
@Component
public class HarvestRunKind implements RunKind {
    private final DSLContext dsl;
    private final PluginCalls calls;
    private final ProposalSubmit proposalSubmit;
    private final JsonMapper json;

    public HarvestRunKind(DSLContext dsl, PluginCalls calls, ProposalSubmit proposalSubmit, JsonMapper json) {
        this.dsl = dsl;
        this.calls = calls;
        this.proposalSubmit = proposalSubmit;
        this.json = json;
    }

    @Override
    public boolean supports(String kind, String coreName) {
        return "Harvester".equals(kind);
    }

    @Override
    public Call call(Context context) {
        JsonNode version = json.readTree(context.versions().data()).get(0);
        String cursor = dsl.select(PLUGIN_CURSORS.CURSOR).from(PLUGIN_CURSORS)
                .where(PLUGIN_CURSORS.INSTANCE_ID.eq(context.instanceId()))
                .and(PLUGIN_CURSORS.OPERATION.eq("harvest")).fetchOne(PLUGIN_CURSORS.CURSOR);
        PluginOutcome<HarvestAnswer> outcome = calls.call(context.instanceId(), Harvester.class, "harvest",
                (plugin, pluginContext) -> plugin.harvest(pluginContext, new HarvestInput(cursor)));
        return new Call(List.of(), List.of(), 0, false, null,
                RunKind.Page.harvest(context.instanceId(), "harvest", outcome,
                        version.path("declares").path("agent")));
    }

    @Override
    public Applied apply(DSLContext tx, Context context, Call call) {
        RunKind.Page page = call.page();
        if (page.failure() != null) {
            return new Applied(0, 0, 0, false, true, false, List.of(page.failure()), "/requests");
        }
        HarvestAnswer answer = (HarvestAnswer) page.answer();
        String agentId = agentId(page.agent());
        List<String> errors = new ArrayList<>();
        for (HarvestAnswer.ProposalItem item : answer.items()) {
            String error = proposeHarvestItem(agentId, item);
            if (error != null) {
                errors.add(error);
            }
        }
        saveCursor(tx, page.instanceId(), page.operation(), answer.nextCursor());
        int count = answer.items().size();
        return new Applied(0, count, count, answer.nextCursor() != null, true, false, errors, "/requests");
    }

    private String agentId(JsonNode agent) {
        if (agent == null || agent.path("name").isMissingNode()) {
            return null;
        }
        return dsl.select(USERS.ID).from(USERS).where(USERS.KIND.eq("agent"))
                .and(USERS.NAME.eq(agent.path("name").asString())).fetchOne(USERS.ID);
    }

    private String proposeHarvestItem(String agentId, HarvestAnswer.ProposalItem item) {
        if (agentId == null) {
            return "The harvester's agent is not configured.";
        }
        Map<String, Object> proposal = new LinkedHashMap<>();
        if (item instanceof HarvestAnswer.CatalogId catalogId) {
            proposal.put("type", "catalogId");
            proposal.put("value", catalogId.catalogId());
        } else if (item instanceof HarvestAnswer.Identifier identifier) {
            proposal.put("type", identifier.type().toLowerCase(Locale.ROOT));
            proposal.put("value", identifier.value());
        }
        if (alreadyOpen(proposal)) {
            return "This item already has an open request.";
        }
        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put("items", List.of(proposal));
        ProposalSubmit.Outcome outcome = proposalSubmit.submitAsAgent(agentId, draft);
        return outcome.status() == 200 ? null : outcome.detail();
    }

    private boolean alreadyOpen(Map<String, Object> proposal) {
        String value = (String) proposal.get("value");
        return dsl.fetchExists(dsl.selectOne().from(REQUESTS).join(DOCUMENTS)
                .on(DOCUMENTS.ID.eq(REQUESTS.DOCUMENT_ID)).where(REQUESTS.DECISION.eq("Pending"))
                .and(DOCUMENTS.CATALOG_ID.eq(value)));
    }

    private void saveCursor(DSLContext tx, String instanceId, String operation, String cursor) {
        tx.insertInto(PLUGIN_CURSORS).set(PLUGIN_CURSORS.INSTANCE_ID, instanceId)
                .set(PLUGIN_CURSORS.OPERATION, operation).set(PLUGIN_CURSORS.CURSOR, cursor)
                .onConflict(PLUGIN_CURSORS.INSTANCE_ID, PLUGIN_CURSORS.OPERATION)
                .doUpdate().set(PLUGIN_CURSORS.CURSOR, cursor).execute();
    }
}
