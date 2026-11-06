package cz.mzk.vera.listing;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record2;
import org.jooq.Record3;
import org.jooq.Select;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Component;

// VIEW-documents: one grouped SQL query per facet, preserving subject and value order.
@Component
public class Facets {
    private final DSLContext dsl;

    public Facets(DSLContext dsl) {
        this.dsl = dsl;
    }

    public record Count(List<Map<String, Object>> values, int noValue) {
        public Count {
            values = List.copyOf(values);
        }
    }

    public Count count(FacetSource source,
            Select<? extends Record2<String, Long>> matchingSubjects, boolean property) {
        Table<?> matches = matchingSubjects.asTable("matching_subjects", "subject_id", "position");
        Field<String> matchedId = DSL.field(DSL.name("matching_subjects", matches.fields()[0].getName()),
            String.class);
        Field<Long> position = DSL.field(DSL.name("matching_subjects", matches.fields()[1].getName()),
            Long.class);
        Table<?> values = source.values().asTable("facet_values", "subject_id", "value", "ordinal");
        Field<String> subjectId = DSL.field(DSL.name("facet_values", values.fields()[0].getName()),
            String.class);
        Field<String> value = DSL.field(DSL.name("facet_values", values.fields()[1].getName()), String.class);
        Field<Integer> ordinal = DSL.field(DSL.name("facet_values", values.fields()[2].getName()),
            Integer.class);
        Field<Long> firstAppearance = DSL.min(position.mul(1_000_000L).add(ordinal.cast(Long.class)));
        var rows = dsl.select(value, DSL.count().as("count"), firstAppearance.as("first"))
            .from(property ? matches.leftJoin(values).on(matchedId.eq(subjectId))
                : matches.join(values).on(matchedId.eq(subjectId)))
            .groupBy(value)
            .orderBy(firstAppearance)
            .fetch();
        List<Map<String, Object>> counts = new ArrayList<>();
        int noValue = 0;
        rows.forEach(row -> {
            if (row.get(value) == null) {
                return;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("value", row.get(value));
            item.put("count", row.get("count", Integer.class));
            counts.add(item);
        });
        if (property) {
            noValue = rows.stream().filter(row -> row.get(value) == null)
                .mapToInt(row -> row.get("count", Integer.class)).sum();
        }
        if (!property) {
            return new Count(counts, 0);
        }
        return new Count(counts, noValue);
    }
}
