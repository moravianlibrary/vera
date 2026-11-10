package cz.mzk.vera.tasks;

import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_LINKS;

import cz.mzk.vera.iterations.IterationCommands;
import cz.mzk.vera.plugin.records.Iteration;
import cz.mzk.vera.plugin.records.Iteration.PublicationLink;
import cz.mzk.vera.plugin.publicationdetector.DetectAnswer;
import cz.mzk.vera.plugin.publicationdetector.DetectInput;
import cz.mzk.vera.plugin.publicationdetector.PublicationDetector;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Component;

// PLG-run-items; PLG-api-kinds; detector discoveries add links through the link act's writer.
@Component
public class PublicationDetectorRunKind implements RunKind {
    private final DSLContext dsl;
    private final PluginCalls calls;
    private final IterationCommands iterationCommands;

    public PublicationDetectorRunKind(DSLContext dsl, PluginCalls calls, IterationCommands iterationCommands) {
        this.dsl = dsl;
        this.calls = calls;
        this.iterationCommands = iterationCommands;
    }

    @Override
    public boolean supports(String kind, String coreName) {
        return "PublicationDetector".equals(kind);
    }

    @Override
    public Call call(Context context) {
        List<Iteration> iterations = context.targets().stream().map(this::iteration).toList();
        PluginOutcome<DetectAnswer> outcome = calls.call(context.instanceId(), PublicationDetector.class, "detect",
                (plugin, pluginContext) -> plugin.detect(pluginContext, new DetectInput(iterations)));
        Map<String, List<DetectAnswer.FoundLink>> byIteration = new LinkedHashMap<>();
        if (outcome instanceof PluginOutcome.Answered<DetectAnswer> answered) {
            for (DetectAnswer.FoundLink link : answered.answer().links()) {
                byIteration.computeIfAbsent(link.iterationId(), ignored -> new ArrayList<>()).add(link);
            }
        }
        List<TargetAnswer> answers = new ArrayList<>();
        for (Target target : context.targets()) {
            answers.add(new TargetAnswer(target,
                    byIteration.getOrDefault(target.iterationId(), List.of()), null, false));
        }
        return new Call(answers, List.of(), answers.size(), false, null, null);
    }

    @Override
    public Applied apply(DSLContext tx, Context context, Call call) {
        int changes = 0;
        for (TargetAnswer answer : call.answers()) {
            @SuppressWarnings("unchecked")
            List<DetectAnswer.FoundLink> links = (List<DetectAnswer.FoundLink>) answer.answer();
            for (DetectAnswer.FoundLink link : links) {
                changes += iterationCommands.addDetectedLink(tx, link.iterationId(), context.instanceId(),
                        link.url()) ? 1 : 0;
            }
        }
        return new Applied(changes, 0, 0, false, false, false, List.of(), "/documents");
    }

    private Iteration iteration(Target target) {
        Record row = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq(target.iterationId())).fetchOne();
        List<PublicationLink> links = dsl.selectFrom(ITERATION_LINKS)
                .where(ITERATION_LINKS.ITERATION_ID.eq(target.iterationId()))
                .orderBy(ITERATION_LINKS.POSITION)
                .fetch(link -> new PublicationLink(link.getId(), link.getUrl(), link.getInstanceId(),
                        link.getSetBy(), link.getSetAt().toInstant(), link.getIsPrimary()));
        return new Iteration(row.get(ITERATIONS.ID), row.get(ITERATIONS.DOCUMENT_ID), row.get(ITERATIONS.ATTEMPT),
                row.get(ITERATIONS.REQUEST_ID), row.get(ITERATIONS.CATEGORY_ID), row.get(ITERATIONS.PRIORITY),
                row.get(ITERATIONS.PROJECT_ID), row.get(ITERATIONS.PROGRESS), row.get(ITERATIONS.LIST_ID),
                row.get(ITERATIONS.FORMER_LIST_NAME), null, null, null, List.of(), List.of(), null,
                row.get(ITERATIONS.DIGITIZED_AT) == null ? null : row.get(ITERATIONS.DIGITIZED_AT).toInstant(),
                links, row.get(ITERATIONS.SCAN_DPI), List.of());
    }
}
