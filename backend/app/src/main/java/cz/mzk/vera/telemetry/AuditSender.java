package cz.mzk.vera.telemetry;

import static cz.mzk.vera.db.tables.Tables.AUDIT_OUTBOX;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.Result;
import org.jooq.impl.DSL;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// OBS-audit-delivery. Deletes only rows accepted by the collector.
@Component
public final class AuditSender {
    private static final Logger LOGGER = LoggerFactory.getLogger(AuditSender.class);
    private static final int BATCH_SIZE = 500;
    private final DSLContext dsl;
    private final JsonMapper json;
    private final HttpClient http;
    private final String role;
    private final String endpoint;

    public AuditSender(DSLContext dsl, JsonMapper json,
            @Value("${vera.role:${VERA_ROLE:all}}") String role,
            @Value("${VERA_OTEL_ENDPOINT:}") String endpoint) {
        this.dsl = dsl;
        this.json = json;
        this.role = role;
        this.endpoint = endpoint;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    @Scheduled(fixedDelayString = "${vera.audit.delay:5000}")
    public void sendDue() {
        if (!("worker".equals(role) || "all".equals(role)) || endpoint.isBlank()) {
            return;
        }
        try {
            dsl.transaction(configuration -> send(DSL.using(configuration)));
        } catch (RuntimeException exception) {
            // The rows stay in the outbox; a later poll sends them again.
            LOGGER.warn("Audit records not sent fault={}", exception.getClass().getName());
        }
    }

    // Several workers may poll at once: each sends only the rows it holds locked, so none twice.
    private void send(DSLContext tx) throws IOException, InterruptedException {
        Result<?> rows = tx.select(AUDIT_OUTBOX.ID, AUDIT_OUTBOX.AT, AUDIT_OUTBOX.RECORD)
                .from(AUDIT_OUTBOX)
                .orderBy(AUDIT_OUTBOX.ID)
                .limit(BATCH_SIZE)
                .forUpdate()
                .skipLocked()
                .fetch();
        if (rows.isEmpty()) {
            return;
        }
        HttpRequest request = HttpRequest.newBuilder(URI.create(logsEndpoint()))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(payload(rows))))
                .build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300 || !accepted(response.body())) {
            LOGGER.warn("Audit records refused by the collector status={}", response.statusCode());
            return;
        }
        List<Long> ids = rows.stream().map(row -> row.get(AUDIT_OUTBOX.ID)).toList();
        tx.deleteFrom(AUDIT_OUTBOX).where(AUDIT_OUTBOX.ID.in(ids)).execute();
    }

    private String logsEndpoint() {
        String base = endpoint.replaceAll("/$", "");
        return base.endsWith("/v1/logs") ? base : base + "/v1/logs";
    }

    private boolean accepted(String response) {
        if (response.isBlank()) {
            return true;
        }
        try {
            JsonNode root = json.readTree(response);
            if (!root.isObject()) {
                return false;
            }
            JsonNode partialSuccess = root.path("partialSuccess");
            if (partialSuccess.isMissingNode()) {
                return true;
            }
            JsonNode rejected = partialSuccess.path("rejectedLogRecords");
            return partialSuccess.isObject() && rejected.isNumber() && rejected.asLong() == 0;
        } catch (RuntimeException exception) {
            return false;
        }
    }

    private Map<String, Object> payload(Result<?> rows) {
        List<Map<String, Object>> records = new ArrayList<>();
        for (Record row : rows) {
            JsonNode record = json.readTree(row.get(AUDIT_OUTBOX.RECORD).data());
            Map<String, Object> attributes = new LinkedHashMap<>();
            attributes.put("vera.stream", stringValue("audit"));
            attributes.put("vera.event.code", stringValue(record.path("code").asString()));
            attributes.put("vera.subject.kind", stringValue(record.path("subject").path("kind").asString()));
            attributes.put("vera.subject.id", stringValue(record.path("subject").path("id").asString()));
            attributes.put("vera.correlation_id", stringValue(record.path("correlationId").asString()));
            attributes.put("vera.actor.kind", stringValue(record.path("actor").path("kind").asString()));
            attributes.put("vera.changes", jsonValue(record.path("changes")));
            attributes.put("vera.data", jsonValue(record.path("data")));
            addIfPresent(attributes, "vera.subject.name", record.path("subject").path("name"));
            addIfPresent(attributes, "vera.actor.name", record.path("actor").path("name"));
            addIfPresent(attributes, "enduser.id", record.path("actor").path("userId"));
            Map<String, Object> log = new LinkedHashMap<>();
            Instant at = row.get(AUDIT_OUTBOX.AT).toInstant();
            log.put("timeUnixNano", Long.toString(at.getEpochSecond() * 1_000_000_000L + at.getNano()));
            log.put("severityNumber", 9);
            log.put("body", stringValue(record.path("code").asString()));
            JsonNode traceId = record.path("traceId");
            if (traceId.isString() && !traceId.asString().isBlank()) {
                log.put("traceId", traceId.asString());
            }
            log.put("attributes", otlpAttributes(attributes));
            records.add(log);
        }
        return Map.of("resourceLogs", List.of(Map.of(
                "resource", Map.of("attributes", otlpAttributes(Map.of("service.name", stringValue("vera-backend")))),
                "scopeLogs", List.of(Map.of("scope", Map.of("name", "vera.audit"), "logRecords", records)))));
    }

    private List<Map<String, Object>> otlpAttributes(Map<String, Object> attributes) {
        return attributes.entrySet().stream()
                .map(entry -> Map.<String, Object>of("key", entry.getKey(), "value", entry.getValue()))
                .toList();
    }

    private Map<String, Object> stringValue(String value) {
        return Map.of("stringValue", value);
    }

    private Map<String, Object> jsonValue(JsonNode value) {
        return stringValue(value.toString());
    }

    private void addIfPresent(Map<String, Object> attributes, String key, JsonNode value) {
        if (value.isString() && !value.asString().isBlank()) {
            attributes.put(key, stringValue(value.asString()));
        }
    }
}
