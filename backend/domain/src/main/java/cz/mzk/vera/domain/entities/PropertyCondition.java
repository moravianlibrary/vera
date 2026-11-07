package cz.mzk.vera.domain.entities;

import java.util.List;
import java.util.Map;

// PLAN-scope and DOC-property-filter: the raw filter fields carried by an intention.
public record PropertyCondition(String key, Boolean hasNoValue, String contains, String startsWith,
    String endsWith, Map<String, Double> numberRange, Map<String, String> dayRange, List<String> anyOf) {}
