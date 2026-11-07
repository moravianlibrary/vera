package cz.mzk.vera.plugin.restriction;

import java.time.Instant;
import java.util.List;

// PLG-api-kinds: Restriction.
public record RestrictionCheckAnswer(List<Finding> findings) {
    public record Finding(String rule, boolean forbidden, Instant until, String why) {}
}
