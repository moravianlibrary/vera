package cz.mzk.vera.domain.entities;

import java.util.List;

// B3 domain entity fields consumed by the Java rule ports.
public record DocumentRecord(Document document, List<Iteration> iterations, List<Request> requests) {}
