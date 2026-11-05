package cz.mzk.vera.events;

import static cz.mzk.vera.db.tables.Tables.AUDIT_OUTBOX;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_MAPPED_ROLES;
import static cz.mzk.vera.db.tables.Tables.USERS;

import com.networknt.schema.InputFormat;
import com.networknt.schema.Schema;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import cz.mzk.vera.domain.access.Access;
import cz.mzk.vera.domain.access.MappedRole;
import cz.mzk.vera.domain.access.RoleHolder;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.web.Instants;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

// EVENT-shape; EVENT-derived; OBS-audit; OBS-audit-delivery; LOG-one-act-one-story. Joins the caller's transaction.
@Service
public class EventRecorder {
    private final DSLContext dsl;
    private final Clock clock;
    private final JsonMapper json;
    private final SchemaRegistry schemas = SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12);
    private final Map<String, Schema> historySchemas;
    private final Schema configurationSchema;

    public EventRecorder(
            DSLContext dsl,
            Clock clock,
            JsonMapper json,
            @Value("${VERA_CONTRACT_DIR}") String contractDir) throws IOException {
        this.dsl = dsl;
        this.clock = clock;
        this.json = json;

        Path cataloguePath = Path.of(contractDir).resolve("events/catalogue.json");
        JsonNode catalogue = json.readTree(Files.readString(cataloguePath));
        Map<String, Schema> loaded = new HashMap<>();
        catalogue.path("historyData").properties().forEach(entry -> loaded.put(
                entry.getKey(),
                schemas.getSchema(json.writeValueAsString(entry.getValue()), InputFormat.JSON)));
        this.historySchemas = Map.copyOf(loaded);
        this.configurationSchema = schemas.getSchema(
                json.writeValueAsString(catalogue.path("configurationData")), InputFormat.JSON);
    }

    // The caller's Spring transaction owns these writes; this recorder opens no transaction.
    public void record(EventInput input) {
        EventCode code = input.code();
        if (code.derived() || (!code.history() && !code.audit())) {
            throw new IllegalArgumentException("Event " + code.code() + " cannot be recorded");
        }
        if (!code.subject().equals(input.subjectKind())) {
            throw new IllegalArgumentException("Subject kind must match event code");
        }

        Instant at = input.at() == null ? clock.instant() : input.at();
        String formattedAt = Instants.format(at);
        if (code.history()) {
            Schema schema = historySchemas.get(code.code());
            if (schema == null || !schema.validate(input.data()).isEmpty()) {
                throw new IllegalArgumentException("Invalid event data for " + code.code());
            }
            dsl.insertInto(EVENTS)
                    .set(EVENTS.ID, "E-" + UUID.randomUUID())
                    .set(EVENTS.CODE, code.code())
                    .set(EVENTS.SUBJECT_KIND, input.subjectKind())
                    .set(EVENTS.SUBJECT_ID, input.subjectId())
                    .set(EVENTS.AT, at.atOffset(ZoneOffset.UTC))
                    .set(EVENTS.ACTOR, JSONB.valueOf(json.writeValueAsString(historyActor(input.actor()))))
                    .set(EVENTS.CORRELATION_ID, input.correlationId())
                    .set(EVENTS.DATA, JSONB.valueOf(json.writeValueAsString(input.data())))
                    .set(EVENTS.REASON_PUBLIC, input.reason() == null ? null : input.reason().publicReason())
                    .set(EVENTS.REASON_INTERNAL, input.reason() == null ? null : input.reason().internal())
                    .execute();
        }
        if (code.audit()) {
            if (!code.history() && !configurationSchema.validate(input.data()).isEmpty()) {
                throw new IllegalArgumentException("Invalid event data for " + code.code());
            }
            ObjectNode record = auditRecord(input, formattedAt);
            dsl.insertInto(AUDIT_OUTBOX)
                    .set(AUDIT_OUTBOX.AT, at.atOffset(ZoneOffset.UTC))
                    .set(AUDIT_OUTBOX.RECORD, JSONB.valueOf(json.writeValueAsString(record)))
                    .execute();
        }
    }

    private ObjectNode historyActor(EventInput.Actor actor) {
        ObjectNode result = json.createObjectNode();
        if (actor instanceof EventInput.System) {
            return result.put("kind", "system");
        }
        if (actor instanceof EventInput.User user) {
            return result.put("kind", "user").put("userId", user.userId());
        }
        return result.put("kind", "undisclosed");
    }

    private ObjectNode auditRecord(EventInput input, String at) {
        ObjectNode record = json.createObjectNode();
        record.put("code", input.code().code());
        record.put("at", at);
        record.put("correlationId", input.correlationId());
        record.putNull("traceId");

        ObjectNode subject = record.putObject("subject");
        subject.put("kind", input.subjectKind());
        subject.put("id", input.subjectId());
        String name = staffName(input.subjectKind(), input.subjectId(), input.subjectName());
        if (name == null) {
            subject.putNull("name");
        } else {
            subject.put("name", name);
        }

        record.set("actor", auditActor(input.actor()));
        if (input.code().history()) {
            record.putArray("changes");
            record.set("data", input.data());
        } else {
            record.set("changes", input.data().path("changes"));
            record.putNull("data");
        }
        return record;
    }

    private String staffName(String subjectKind, String subjectId, String supplied) {
        if (!"user".equals(subjectKind)) {
            return supplied;
        }
        var user = dsl.selectFrom(USERS).where(USERS.ID.eq(subjectId)).fetchOne();
        if (user == null || isReader(subjectId)) {
            return null;
        }
        return user.getName();
    }

    private ObjectNode auditActor(EventInput.Actor actor) {
        if (actor instanceof EventInput.System) {
            return json.createObjectNode().put("kind", "system");
        }
        if (actor instanceof EventInput.Undisclosed) {
            return json.createObjectNode().put("kind", "reader");
        }

        String userId = ((EventInput.User) actor).userId();
        var user = dsl.selectFrom(USERS).where(USERS.ID.eq(userId)).fetchOne();
        if (user == null) {
            throw new IllegalStateException("Cannot record audit actor: no user " + userId);
        }
        if (isReader(userId)) {
            return json.createObjectNode().put("kind", "reader");
        }
        String kind = "agent".equals(user.getKind()) ? "agent" : "user";
        return json.createObjectNode()
                .put("kind", kind)
                .put("userId", userId)
                .put("name", user.getName());
    }

    private boolean isReader(String userId) {
        List<String> hand = dsl.select(USER_HAND_ROLES.ROLE_ID)
                .from(USER_HAND_ROLES)
                .where(USER_HAND_ROLES.USER_ID.eq(userId))
                .fetch(USER_HAND_ROLES.ROLE_ID);
        List<MappedRole> mapped = dsl.selectFrom(USER_MAPPED_ROLES)
                .where(USER_MAPPED_ROLES.USER_ID.eq(userId))
                .fetch(row -> new MappedRole(row.getRoleId(), row.getInstanceId(), row.getClaim()));
        return Access.heldRoleIdsOf(new RoleHolder(hand, mapped, null))
                .stream()
                .allMatch("reader"::equals);
    }
}
