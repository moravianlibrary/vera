package cz.mzk.vera.tasks;

import cz.mzk.vera.domain.schedules.Schedules;
import cz.mzk.vera.jobs.Jobs;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// ENT-schedule; LC-INT-repeat: jobs carry the occurrence that made them due.
@Component
public class ScheduleQueue {
    private final Jobs jobs;
    private final Clock clock;
    private final JsonMapper json;

    public ScheduleQueue(Jobs jobs, Clock clock, JsonMapper json) {
        this.jobs = jobs;
        this.clock = clock;
        this.json = json;
    }

    public Instant next(Map<String, Object> cadence, Instant after) {
        return Schedules.nextOccurrenceOf(cadence, after, ZoneId.of("Europe/Prague"));
    }

    public long queue(DSLContext dsl, String scheduleId, Map<String, Object> cadence, Instant after) {
        Instant occurrence = next(cadence, after);
        if (occurrence == null) {
            return 0;
        }
        return queueAt(dsl, scheduleId, occurrence);
    }

    public long queueAt(DSLContext dsl, String scheduleId, Instant occurrence) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("scheduleId", scheduleId);
        payload.put("occurrence", occurrence.toString());
        return jobs.enqueue(dsl, "schedule.fire", occurrence, payload);
    }

    public Map<String, Object> cadence(String raw) {
        JsonNode node = json.readTree(raw);
        Map<String, Object> result = new LinkedHashMap<>();
        node.properties().forEach(entry -> result.put(entry.getKey(),
                json.convertValue(entry.getValue(), Object.class)));
        return result;
    }
}
