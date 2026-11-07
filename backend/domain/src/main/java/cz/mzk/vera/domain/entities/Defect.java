package cz.mzk.vera.domain.entities;

// B3 domain entity fields consumed by the Java rule ports.
public record Defect(String key, String instanceId, String ruleCode, String subject, String firstSeenAt) {}
