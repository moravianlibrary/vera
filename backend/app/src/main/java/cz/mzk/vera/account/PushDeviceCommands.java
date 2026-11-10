package cz.mzk.vera.account;

import static cz.mzk.vera.db.tables.Tables.PUSH_DEVICES;

import java.time.Clock;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

// WATCH-push: keep each person's browser subscription for the Web Push sender.
@Repository
public class PushDeviceCommands {
    private final DSLContext dsl;
    private final Clock clock;
    private final String publicKey;

    public PushDeviceCommands(DSLContext dsl, Clock clock,
            @Value("${vera.push.public-key:BNbxGYNMhEIi9zrneh7mqV4oUanjLUK3m-mYZBc62frMKrEoMk88r3Lk596T0ck9xlT-aOe2kJPcZ4TlTjaUeCs}")
            String publicKey) {
        this.dsl = dsl;
        this.clock = clock;
        this.publicKey = publicKey;
    }

    public Map<String, Object> forPerson(String userId) {
        return response(userId);
    }

    public Map<String, Object> register(String userId, Subscription subscription) {
        boolean exists = dsl.fetchExists(dsl.selectOne().from(PUSH_DEVICES)
                .where(PUSH_DEVICES.USER_ID.eq(userId))
                .and(PUSH_DEVICES.ENDPOINT.eq(subscription.endpoint())));
        if (!exists) {
            dsl.insertInto(PUSH_DEVICES)
                    .set(PUSH_DEVICES.ID, UUID.randomUUID().toString())
                    .set(PUSH_DEVICES.USER_ID, userId)
                    .set(PUSH_DEVICES.ENDPOINT, subscription.endpoint())
                    .set(PUSH_DEVICES.P256DH, subscription.keys().p256dh())
                    .set(PUSH_DEVICES.AUTH, subscription.keys().auth())
                    .set(PUSH_DEVICES.CREATED_AT, clock.instant().atOffset(ZoneOffset.UTC))
                    .execute();
        }
        return response(userId);
    }

    private Map<String, Object> response(String userId) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("publicKey", publicKey);
        result.put("deviceCount", dsl.fetchCount(dsl.selectFrom(PUSH_DEVICES)
                .where(PUSH_DEVICES.USER_ID.eq(userId))));
        return result;
    }

    public record Subscription(String endpoint, Keys keys) {}
    public record Keys(String p256dh, String auth) {}
}
