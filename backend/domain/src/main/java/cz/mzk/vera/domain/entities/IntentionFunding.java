package cz.mzk.vera.domain.entities;

// PLAN-scope: an intention counts any project, no project, or one named project.
public record IntentionFunding(String kind, String projectId) {}
