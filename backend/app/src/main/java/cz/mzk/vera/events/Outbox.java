package cz.mzk.vera.events;

import static cz.mzk.vera.db.tables.Tables.OUTBOX;

import cz.mzk.vera.web.Instants;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.Record;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// OBS-audit-delivery; delivery channels are added as acts need them.
@Repository
public class Outbox {
    private final DSLContext dsl;
    private final Clock clock;
    private final JsonMapper json;

    public Outbox(DSLContext dsl, Clock clock, JsonMapper json) {
        this.dsl = dsl;
        this.clock = clock;
        this.json = json;
    }

    public long send(String channel, String recipient, JsonNode payload) {
        return dsl.insertInto(OUTBOX)
                .set(OUTBOX.CHANNEL, channel)
                .set(OUTBOX.RECIPIENT, recipient)
                .set(OUTBOX.PAYLOAD, JSONB.valueOf(json.writeValueAsString(payload)))
                .set(OUTBOX.SENT_AT, clock.instant().atOffset(ZoneOffset.UTC))
                .returning(OUTBOX.ID)
                .fetchOne()
                .getId();
    }

    public List<OutboxMessage> list(Optional<String> channel) {
        var query = dsl.selectFrom(OUTBOX);
        if (channel.isPresent()) {
            return query.where(OUTBOX.CHANNEL.eq(channel.get()))
                    .orderBy(OUTBOX.ID)
                    .fetch(this::messageOf);
        }
        return query.orderBy(OUTBOX.ID).fetch(this::messageOf);
    }

    private OutboxMessage messageOf(Record row) {
        return new OutboxMessage(
                row.get(OUTBOX.ID),
                row.get(OUTBOX.CHANNEL),
                row.get(OUTBOX.RECIPIENT),
                json.readTree(row.get(OUTBOX.PAYLOAD).data()),
                Instants.format(row.get(OUTBOX.SENT_AT).toInstant()));
    }

    public record OutboxMessage(long id, String channel, String recipient, JsonNode payload, String sentAt) {}
}
