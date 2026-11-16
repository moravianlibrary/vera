package cz.mzk.vera.listing;

import java.util.List;
import org.jooq.Record1;
import org.jooq.Select;
import org.springframework.stereotype.Component;

// UI-grouping: reads every matching id for totals and groups; a real cursor encodes its sort key.
@Component
public class ListQuery {
    public List<String> ids(Select<Record1<String>> orderedSelect) {
        return orderedSelect.fetch(0, String.class);
    }
}
