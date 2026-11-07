package cz.mzk.vera.validations;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.ITERATION_VERDICTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.domain.iterations.Iterations.progressAfterGates;
import static cz.mzk.vera.domain.iterations.Iterations.scopeOfIteration;
import static cz.mzk.vera.domain.status.Status.approvedKeysOf;
import static cz.mzk.vera.domain.status.Status.outstandingDefects;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.documents.DocumentStates;
import cz.mzk.vera.domain.entities.Defect;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.entities.Verdict;
import cz.mzk.vera.domain.entities.VerdictKind;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.domain.validations.Validations;
import cz.mzk.vera.domain.iterations.Iterations;
import cz.mzk.vera.events.Correlation;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

// ACT-accept; ACT-deny; ACT-revoke; STAT-gates-move-progress: each verdict is one transaction.
@Component
class ValidationCommands {
    private final DSLContext dsl;
    private final HeldAccessQueries heldAccess;
    private final DocumentStates states;
    private final EventRecorder events;
    private final Clock clock;
    private final JsonMapper json;

    ValidationCommands(DSLContext dsl, HeldAccessQueries heldAccess, DocumentStates states,
            EventRecorder events, Clock clock, JsonMapper json) {
        this.dsl = dsl;
        this.heldAccess = heldAccess;
        this.states = states;
        this.events = events;
        this.clock = clock;
        this.json = json;
    }

    @Transactional
    ActResult accept(Caller caller, String id, Acceptance body) {
        return append(caller, id, ValidationCodes.APPROVE, body.defectKeys(), "Approved",
                body.note() == null ? "" : body.note(), null);
    }

    @Transactional
    ActResult deny(Caller caller, String id, Denial body) {
        return append(caller, id, ValidationCodes.DENY, body.defectKeys(), "Denied",
                body.internalText() == null ? "" : body.internalText(), body.publicText());
    }

    @Transactional
    ActResult revoke(Caller caller, String id, Revocation body) {
        Row row = rowToRuleOn(caller, id, ValidationCodes.REVOKE);
        if (row.refusal() != null) {
            return row.refusal();
        }
        Set<String> approved = approvedKeysOf(row.iteration());
        Set<String> present = row.iteration().defects().stream().map(Defect::key)
                .collect(java.util.stream.Collectors.toSet());
        if (!body.defectKeys().stream().allMatch(key -> approved.contains(key) && present.contains(key))) {
            return ActResult.refused(409, "Those defects are not accepted now",
                    ValidationCodes.DEFECTS_NOT_ACCEPTED);
        }
        return write(caller, row, body.defectKeys(), "Revoked", "", null);
    }

    private ActResult append(Caller caller, String id, String permission, List<String> keys,
            String verdict, String note, String publicText) {
        Row found = rowToRuleOn(caller, id, permission);
        if (found.refusal() != null) {
            return found.refusal();
        }
        Iteration iteration = found.iteration();
        if (Validations.reviewStateOf(iteration) != Validations.ReviewState.Needed) {
            return ActResult.refused(409, ValidationCodes.NOT_WAITING_MESSAGE, null);
        }
        Set<String> outstanding = outstandingDefects(iteration).stream()
                .map(Defect::key).collect(java.util.stream.Collectors.toSet());
        if (!keys.stream().allMatch(outstanding::contains)) {
            return ActResult.refused(409, ValidationCodes.DEFECTS_CHANGED, null);
        }
        return write(caller, found, keys, verdict, note, publicText);
    }

    private ActResult write(Caller caller, Row row, List<String> keys, String verdict,
            String note, String publicText) {
        Iteration iteration = row.iteration();
        int position = dsl.selectCount().from(ITERATION_VERDICTS)
                .where(ITERATION_VERDICTS.ITERATION_ID.eq(iteration.id())).fetchOne(0, int.class);
        Instant at = clock.instant();
        dsl.insertInto(ITERATION_VERDICTS)
                .set(ITERATION_VERDICTS.ITERATION_ID, iteration.id())
                .set(ITERATION_VERDICTS.POSITION, position)
                .set(ITERATION_VERDICTS.VERDICT, verdict)
                .set(ITERATION_VERDICTS.DEFECT_KEYS, keys.toArray(String[]::new))
                .set(ITERATION_VERDICTS.ACTOR_ID, caller.userId())
                .set(ITERATION_VERDICTS.AT, at.atOffset(ZoneOffset.UTC))
                .set(ITERATION_VERDICTS.NOTE, note)
                .set(ITERATION_VERDICTS.PUBLIC_TEXT, publicText)
                .execute();
        List<Verdict> verdicts = new ArrayList<>(iteration.verdicts());
        verdicts.add(new Verdict(keys, VerdictKind.valueOf(verdict)));
        Iteration ruled = new Iteration(iteration.id(), iteration.documentId(), iteration.attempt(),
                iteration.requestId(), iteration.categoryId(), iteration.projectId(), iteration.progress(),
                iteration.restriction(), iteration.restrictionOverride(), iteration.cancellation(),
                iteration.defects(), verdicts, iteration.links());
        String progress = progressAfterGates(ruled).name();
        dsl.update(ITERATIONS).set(ITERATIONS.PROGRESS, progress)
                .where(ITERATIONS.ID.eq(iteration.id())).execute();
        int askerCount = dsl.select(REQUESTS.REQUESTER_ID).from(REQUESTS)
                .where(REQUESTS.ITERATION_ID.eq(iteration.id())
                        .or(REQUESTS.TRACKS_ITERATION_ID.eq(iteration.id())))
                .fetch(REQUESTS.REQUESTER_ID).stream().distinct().toList().size();
        List<Map<String, Object>> defects = iteration.defects().stream()
                .filter(defect -> keys.contains(defect.key()))
                .map(defect -> defectData(defect)).toList();
        String names = defectName(iteration, keys);
        String internal = note.isEmpty() ? names : names + " — " + note;
        String progressNote = iteration.progress().name().equals(progress) ? null
                : "Ready".equals(progress) ? "Every gate passes: Ready."
                : "Back to " + progress + ": a gate holds it.";
        if (progressNote != null) {
            internal = internal.isEmpty() ? progressNote : internal + " " + progressNote;
        }
        EventCode code = switch (verdict) {
            case "Approved" -> EventCode.ITERATION_VERDICT_ACCEPTED;
            case "Denied" -> EventCode.ITERATION_VERDICT_DENIED;
            default -> EventCode.ITERATION_VERDICT_REVOKED;
        };
        events.record(new EventInput(code, "iteration", iteration.id(), null,
                new EventInput.User(caller.userId()), Correlation.newId(), at,
                json.valueToTree(Map.of("defects", defects)),
                new EventInput.Reason(publicText, internal.isEmpty() ? null : internal)));
        states.recompute(dsl, iteration.documentId());
        Iteration changed = new Iteration(iteration.id(), iteration.documentId(), iteration.attempt(),
                iteration.requestId(), iteration.categoryId(), iteration.projectId(),
                Progress.valueOf(progress), iteration.restriction(),
                iteration.restrictionOverride(), iteration.cancellation(), iteration.defects(), verdicts,
                iteration.links());
        Validations.ReviewState review = Validations.reviewStateOf(changed);
        Map<String, Object> answer = new LinkedHashMap<>();
        answer.put("iterationId", iteration.id());
        answer.put("review", review == null ? null : review.name());
        answer.put("progress", progress);
        answer.put("askerCount", askerCount);
        return ActResult.ok(answer);
    }

    private String defectName(Iteration iteration, List<String> keys) {
        return iteration.defects().stream().filter(defect -> keys.contains(defect.key()))
                .map(defect -> Validations.defectNameOf(defect, this::instanceName)).distinct()
                .collect(java.util.stream.Collectors.joining(", "));
    }

    private Map<String, Object> defectData(Defect defect) {
        Map<String, Object> instance = new LinkedHashMap<>();
        instance.put("id", defect.instanceId());
        instance.put("name", instanceName(defect.instanceId()));
        return Map.of("instance", instance, "rule", defect.ruleCode());
    }

    private String instanceName(String id) {
        String name = dsl.select(PLUGIN_INSTANCES.NAME).from(PLUGIN_INSTANCES)
                .where(PLUGIN_INSTANCES.ID.eq(id)).fetchOne(PLUGIN_INSTANCES.NAME);
        return name == null ? id : name;
    }

    private Row rowToRuleOn(Caller caller, String id, String permission) {
        var record = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq(id)).fetchOne();
        if (record == null) {
            return Row.refused(ActResult.refused(404, ValidationCodes.NOTHING_WAITS,
                    ValidationCodes.NOT_WAITING));
        }
        var held = heldAccess.scopesHeldBy(caller.userId());
        List<Category> categories = dsl.select(CATEGORIES.ID, CATEGORIES.PARENT_ID).from(CATEGORIES)
                .fetch(value -> new Category(value.value1(), value.value2()));
        Iterations.IterationScope scope = scopeOfIteration(categories, record.getCategoryId());
        boolean reached = List.of(ValidationCodes.APPROVE, ValidationCodes.DENY, ValidationCodes.REVOKE)
                .stream().anyMatch(candidate -> held.reachesIteration(candidate, scope.categoryPathIds()));
        var laterAttempt = dsl.selectOne().from(ITERATIONS)
                .where(ITERATIONS.DOCUMENT_ID.eq(record.getDocumentId())
                        .and(ITERATIONS.ATTEMPT.gt(record.getAttempt())));
        boolean current = dsl.fetchExists(laterAttempt);
        if (!reached || current) {
            return Row.refused(ActResult.refused(404, ValidationCodes.NOTHING_WAITS,
                    ValidationCodes.NOT_WAITING));
        }
        if (!held.hasPermission(permission)) {
            return Row.refused(ActResult.refused(403, ValidationCodes.MAY_NOT_GIVE, null));
        }
        if (!held.reachesIteration(permission, scope.categoryPathIds())) {
            return Row.refused(ActResult.refused(403, ValidationCodes.MAY_NOT_GIVE, null));
        }
        Iteration iteration = states.recordOf(dsl, record.getDocumentId()).iterations().stream()
                .filter(value -> value.id().equals(id)).findFirst().orElseThrow();
        if (Validations.reviewStateOf(iteration) == Validations.ReviewState.Forbidden) {
            return Row.refused(ActResult.refused(409, "A rule forbids it; only an administrator can lift it",
                    ValidationCodes.FORBIDDEN_BY_RULE));
        }
        return Row.found(iteration);
    }

    private record Row(Iteration iteration, ActResult refusal) {
        static Row found(Iteration iteration) { return new Row(iteration, null); }
        static Row refused(ActResult refusal) { return new Row(null, refusal); }
    }

    record Acceptance(List<String> defectKeys, String note) {}
    record Denial(List<String> defectKeys, String publicText, String internalText) {}
    record Revocation(List<String> defectKeys) {}
}
