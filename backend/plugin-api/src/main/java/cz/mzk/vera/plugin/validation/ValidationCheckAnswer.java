package cz.mzk.vera.plugin.validation;

import java.util.List;

// PLG-api-kinds: Validation.
public record ValidationCheckAnswer(List<Defect> defects) {
    public record Defect(String rule, String field, String detail) {}
}
