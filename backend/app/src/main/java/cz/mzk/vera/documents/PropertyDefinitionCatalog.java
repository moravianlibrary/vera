package cz.mzk.vera.documents;

import java.util.Set;
import org.springframework.modulith.NamedInterface;
import org.jooq.DSLContext;

// DOC-property-filter: the owning definitions reader shared with the properties acts.
@NamedInterface("property-definitions")
public interface PropertyDefinitionCatalog {
    Set<String> catalogPropertyKeys(DSLContext dsl);
}
