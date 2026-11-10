package cz.mzk.vera.tasks;

import cz.mzk.vera.requests.RequestPlacements;
import java.util.List;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;

// L8; ACCESS-custody-by-plugins.
@Component
public class PlacingRunKind implements RunKind {
    private final DSLContext dsl;
    private final RequestPlacements placements;

    public PlacingRunKind(DSLContext dsl, RequestPlacements placements) {
        this.dsl = dsl;
        this.placements = placements;
    }

    @Override
    public boolean supports(String kind, String coreName) {
        return "VERA".equals(coreName);
    }

    @Override
    public Call call(Context context) {
        List<PlacementAnswer> answers = context.placementTargets().stream()
                .map(target -> new PlacementAnswer(target.position(), target.requestId(),
                        placements.preview(dsl, target.requestId())))
                .toList();
        return new Call(List.of(), answers, answers.size(), false, null, null);
    }

    @Override
    public Applied apply(DSLContext tx, Context context, Call call) {
        for (PlacementAnswer answer : call.placements()) {
            placements.apply(tx, answer.requestId(), answer.placement());
        }
        return new Applied(0, 0, call.placements().size(), false, false, true, List.of(), "/requests");
    }
}
