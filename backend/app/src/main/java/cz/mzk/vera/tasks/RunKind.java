package cz.mzk.vera.tasks;

import cz.mzk.vera.requests.RequestPlacements;
import cz.mzk.vera.pluginhost.PluginOutcome;
import cz.mzk.vera.plugin.catalog.ChangesAnswer;
import cz.mzk.vera.plugin.catalog.SyncAnswer;
import cz.mzk.vera.plugin.harvester.HarvestAnswer;
import java.util.List;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import tools.jackson.databind.JsonNode;

// PLG-run-items; plugin calls and their answers belong to one run kind.
public interface RunKind {
    boolean supports(String kind, String coreName);

    Call call(Context context);

    Applied apply(DSLContext tx, Context context, Call call);

    record Context(String runId, int offset, String instanceId, String instanceName, String kind,
            String coreName, JSONB versions, List<Target> targets, List<PlacementTarget> placementTargets) { }

    record Target(int position, String documentId, String requestId, String iterationId, String catalogId,
            String title, String documentType, String shelfMark) { }

    record PlacementTarget(int position, String requestId) { }

    record TargetAnswer(Target target, Object answer, String error, boolean unavailable) { }

    record PlacementAnswer(int position, String requestId, RequestPlacements.Placement placement) { }

    record Call(List<TargetAnswer> answers, List<PlacementAnswer> placements, int processed,
            boolean allUnavailable, String failure, Page page) { }

    record Page(String instanceId, String operation, Object answer, String failure, JsonNode agent) {
        static Page sync(String instanceId, String operation, PluginOutcome<SyncAnswer> outcome, JsonNode agent) {
            return page(instanceId, operation, outcome, agent);
        }

        static Page changes(String instanceId, String operation, PluginOutcome<ChangesAnswer> outcome, JsonNode agent) {
            return page(instanceId, operation, outcome, agent);
        }

        static Page harvest(String instanceId, String operation, PluginOutcome<HarvestAnswer> outcome,
                JsonNode agent) {
            return page(instanceId, operation, outcome, agent);
        }

        private static Page page(String instanceId, String operation, PluginOutcome<?> outcome, JsonNode agent) {
            if (outcome instanceof PluginOutcome.Answered<?> answered) {
                return new Page(instanceId, operation, answered.answer(), null, agent);
            }
            if (outcome instanceof PluginOutcome.Refused<?> refused) {
                return new Page(instanceId, operation, null, refused.code() + ": " + refused.message(), agent);
            }
            return new Page(instanceId, operation, null, "The source did not answer.", agent);
        }
    }

    record Applied(int changes, int itemCountDelta, int doneCountDelta, boolean more,
            boolean page, boolean placing, List<String> errors, String changePath) { }
}
