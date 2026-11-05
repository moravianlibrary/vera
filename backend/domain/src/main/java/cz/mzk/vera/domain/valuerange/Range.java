package cz.mzk.vera.domain.valuerange;

// FILTER-range: inclusive range endpoints.
public record Range<T>(T from, T to) {}
