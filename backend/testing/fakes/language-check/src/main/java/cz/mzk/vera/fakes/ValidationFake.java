package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.validation.Validation;
import cz.mzk.vera.plugin.validation.ValidationCheckAnswer;
import cz.mzk.vera.plugin.validation.ValidationCheckInput;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

// BK4g; PLG-api-kinds: Validation.
public final class ValidationFake implements Validation {
    @Override
    public ValidationCheckAnswer check(PluginContext context, ValidationCheckInput input) {
        Map<String, List<String>> answer = IngestWire.call(context, "Validation", "check",
                input.record().id(), input.record().catalogId());
        IngestWire.check(answer);
        List<ValidationCheckAnswer.Defect> defects = new ArrayList<>();
        List<String> rules = IngestWire.aligned(answer, "defectRule", "defectField", "defectDetail");
        List<String> fields = Wire.all(answer, "defectField");
        List<String> details = Wire.all(answer, "defectDetail");
        for (int index = 0; index < rules.size(); index++) {
            defects.add(new ValidationCheckAnswer.Defect(rules.get(index), fields.get(index), details.get(index)));
        }
        return new ValidationCheckAnswer(List.copyOf(defects));
    }
}
