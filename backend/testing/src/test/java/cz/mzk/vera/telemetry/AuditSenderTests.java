package cz.mzk.vera.testing.telemetry;

import static cz.mzk.vera.db.tables.Tables.AUDIT_OUTBOX;
import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import cz.mzk.vera.telemetry.AuditSender;
import cz.mzk.vera.testing.VeraTestingApplication;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

// OBS-audit-delivery.
@SpringBootTest(classes = VeraTestingApplication.class)
@ActiveProfiles("test")
@Testcontainers
class AuditSenderTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired private DSLContext dsl;
    @Autowired private JsonMapper json;

    @BeforeEach
    void clearOutbox() {
        dsl.deleteFrom(AUDIT_OUTBOX).execute();
    }

    @Test
    void sendsRowsInOrderAndDeletesAcceptedRows() throws Exception {
        insertRecord("first.event");
        insertRecord("second.event");
        AtomicReference<String> received = new AtomicReference<>();
        HttpServer server = server(200, received);
        try {
            new AuditSender(dsl, json, "all", endpoint(server)).sendDue();
        } finally {
            server.stop(0);
        }

        var records = json.readTree(received.get()).path("resourceLogs").get(0)
                .path("scopeLogs").get(0).path("logRecords");
        assertThat(records.get(0).path("body").path("stringValue").asString()).isEqualTo("first.event");
        assertThat(records.get(1).path("body").path("stringValue").asString()).isEqualTo("second.event");
        assertThat(dsl.fetchCount(AUDIT_OUTBOX)).isZero();
    }

    @Test
    void keepsRowsWhenCollectorReturnsServerError() throws Exception {
        insertRecord("first.event");
        HttpServer server = server(500, new AtomicReference<>());
        try {
            new AuditSender(dsl, json, "all", endpoint(server)).sendDue();
        } finally {
            server.stop(0);
        }

        assertThat(dsl.fetchCount(AUDIT_OUTBOX)).isOne();
    }

    @Test
    void doesNothingWithoutAnEndpoint() {
        insertRecord("first.event");

        new AuditSender(dsl, json, "all", "").sendDue();

        assertThat(dsl.fetchCount(AUDIT_OUTBOX)).isOne();
    }

    private void insertRecord(String code) {
        String record = "{\"code\":\"" + code + "\",\"at\":\"2026-11-13T00:00:00.000Z\","
                + "\"traceId\":null,\"correlationId\":\"C-1\","
                + "\"subject\":{\"kind\":\"project\",\"id\":\"P-1\",\"name\":null},"
                + "\"actor\":{\"kind\":\"system\"},\"changes\":[],\"data\":null}";
        dsl.insertInto(AUDIT_OUTBOX)
                .set(AUDIT_OUTBOX.AT, Instant.parse("2026-11-13T00:00:00Z").atOffset(ZoneOffset.UTC))
                .set(AUDIT_OUTBOX.RECORD, JSONB.valueOf(record))
                .execute();
    }

    private HttpServer server(int status, AtomicReference<String> body) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/logs", exchange -> {
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            exchange.sendResponseHeaders(status, -1);
            exchange.close();
        });
        server.start();
        return server;
    }

    private String endpoint(HttpServer server) {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }
}
