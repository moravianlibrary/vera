package cz.mzk.vera.listing;

import org.jooq.Record3;
import org.jooq.Select;

// UI-facets: a facet's subject id, value and ordinal in that subject's own values.
public record FacetSource(String field, Select<? extends Record3<String, String, Integer>> values,
        String propertyKey) {}
