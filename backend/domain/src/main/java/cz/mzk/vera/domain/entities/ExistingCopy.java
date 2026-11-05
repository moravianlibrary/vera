package cz.mzk.vera.domain.entities;

// B3 domain entity fields consumed by the Java rule ports.
public record ExistingCopy(String source, RegistryState state, String link, String iterationId) {}
