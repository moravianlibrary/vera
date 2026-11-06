package cz.mzk.vera.listing;

import org.jooq.Condition;

// VIEW-documents: one named SQL condition in a list query.
public record ListFilter(String field, Condition condition) {}
