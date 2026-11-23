package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.restriction.Restriction;
import cz.mzk.vera.plugin.restriction.RestrictionCheckAnswer;
import cz.mzk.vera.plugin.restriction.RestrictionCheckInput;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
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
        List<String> czech = Wire.all(answer, "findingPublicCs");
        List<String> english = Wire.all(answer, "findingPublicEn");
        for (int index = 0; index < rules.size(); index++) {
            Instant until = untilValues.get(index).isEmpty() ? null : Instant.parse(untilValues.get(index));
            // What askers read, by language: an empty field gives none in it.
            Map<String, String> publicText = new LinkedHashMap<>();
            if (index < czech.size() && !czech.get(index).isEmpty()) publicText.put("cs", czech.get(index));
            if (index < english.size() && !english.get(index).isEmpty()) publicText.put("en", english.get(index));
            findings.add(new RestrictionCheckAnswer.Finding(rules.get(index),
                    Boolean.parseBoolean(forbidden.get(index)), until, reasons.get(index),
                    publicText.isEmpty() ? null : Map.copyOf(publicText)));
        }
        return new RestrictionCheckAnswer(List.copyOf(findings));
    }
}
