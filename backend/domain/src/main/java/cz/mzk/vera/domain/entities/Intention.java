package cz.mzk.vera.domain.entities;

import java.util.List;

// PLAN-intention, PLAN-scope, PLAN-counting, PLAN-target, PLAN-mix-within-scope.
public record Intention(String id, IntentionFunding funding, String scopeCategoryId,
    List<PropertyCondition> scopeConditions, String countsFrom, String endsOn, Integer targetPages,
    boolean isOverall, String archivedAt) {}
