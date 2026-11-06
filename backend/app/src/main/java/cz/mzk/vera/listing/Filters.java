package cz.mzk.vera.listing;

import static org.jooq.impl.DSL.noCondition;

import java.util.List;
import org.jooq.Condition;

// VIEW-documents: combine active filters and omit a field while counting its facet.
public record Filters(List<ListFilter> active) {
    public Filters {
        active = List.copyOf(active);
    }

    public Condition all() {
        return active.stream().map(ListFilter::condition).reduce(noCondition(), Condition::and);
    }

    public Condition allBut(String field) {
        return active.stream().filter(filter -> !filter.field().equals(field))
            .map(ListFilter::condition).reduce(noCondition(), Condition::and);
    }
}
