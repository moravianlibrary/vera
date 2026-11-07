package cz.mzk.vera.domain.entities;

import java.util.Map;

// PLAN-mix-sets: percentages are stored per category and are not scaled.
public record Distribution(Map<String, Double> shares) {}
