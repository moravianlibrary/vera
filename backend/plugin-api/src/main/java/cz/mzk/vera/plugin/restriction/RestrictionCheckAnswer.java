package cz.mzk.vera.plugin.restriction;

import java.time.Instant;
import java.util.List;
import java.util.Map;

// PLG-api-kinds: Restriction. `why` is for staff; `publicText` is what askers read, by language
// ("cs", "en"), or null for VERA's own wording (STAT-public; contract 1.4).
public record RestrictionCheckAnswer(List<Finding> findings) {
    public record Finding(String rule, boolean forbidden, Instant until, String why,
            Map<String, String> publicText) {
        public Finding(String rule, boolean forbidden, Instant until, String why) {
            this(rule, forbidden, until, why, null);
        }
    }
}
