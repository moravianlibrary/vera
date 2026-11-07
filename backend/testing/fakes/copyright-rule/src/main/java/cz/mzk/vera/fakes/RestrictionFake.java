package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.restriction.Restriction;
import cz.mzk.vera.plugin.restriction.RestrictionCheckAnswer;
import cz.mzk.vera.plugin.restriction.RestrictionCheckInput;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

// BK4g; PLG-api-kinds: Restriction.
public final class RestrictionFake implements Restriction {
    @Override
    public RestrictionCheckAnswer check(PluginContext context, RestrictionCheckInput input) {
        Map<String, List<String>> answer = IngestWire.call(context, "Restriction", "check",
                input.record().id(), input.record().catalogId());
        IngestWire.check(answer);
        List<RestrictionCheckAnswer.Finding> findings = new ArrayList<>();
        List<String> rules = IngestWire.aligned(answer, "findingRule", "findingForbidden", "findingUntil",
                "findingWhy");
        List<String> forbidden = Wire.all(answer, "findingForbidden");
        List<String> untilValues = Wire.all(answer, "findingUntil");
        List<String> reasons = Wire.all(answer, "findingWhy");
        for (int index = 0; index < rules.size(); index++) {
            Instant until = untilValues.get(index).isEmpty() ? null : Instant.parse(untilValues.get(index));
            findings.add(new RestrictionCheckAnswer.Finding(rules.get(index),
                    Boolean.parseBoolean(forbidden.get(index)), until, reasons.get(index)));
        }
        return new RestrictionCheckAnswer(List.copyOf(findings));
    }
}
