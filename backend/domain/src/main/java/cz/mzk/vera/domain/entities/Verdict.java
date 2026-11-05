package cz.mzk.vera.domain.entities;

import java.util.List;

// B3 domain entity fields consumed by the Java rule ports.
public record Verdict(List<String> defectKeys, VerdictKind verdict) {}
