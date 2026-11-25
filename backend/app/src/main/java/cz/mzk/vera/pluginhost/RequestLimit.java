package cz.mzk.vera.pluginhost;

import java.time.Duration;
import tools.jackson.databind.JsonNode;

// PLG-api-session: at most so many requests in a window; an instance with none set has the default.
public record RequestLimit(int requests, Duration window) {
    public static final RequestLimit DEFAULT = new RequestLimit(300, Duration.ofMinutes(5));

    // As stored and sent: {"requests": 300, "minutes": 5}, or null for the default.
    public static RequestLimit of(JsonNode stored) {
        if (stored == null || !stored.isObject()) return DEFAULT;
        int requests = stored.path("requests").asInt(0);
        int minutes = stored.path("minutes").asInt(0);
        return requests > 0 && minutes > 0 ? new RequestLimit(requests, Duration.ofMinutes(minutes)) : DEFAULT;
    }
}
