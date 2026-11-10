package cz.mzk.vera.hooks;

import static cz.mzk.vera.db.tables.Tables.HOOK_DELIVERIES;

import cz.mzk.vera.jobs.Job;
import java.time.Clock;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

// HOOK-retry; person-started attempts call the plugin before opening the apply transaction.
@Service
public class HookDeliveryActions {
    private final HookDeliverJob deliveries;
    private final TransactionTemplate transactions;
    private final JsonMapper json;
    private final Clock clock;
    private final DSLContext dsl;

    public HookDeliveryActions(HookDeliverJob deliveries, PlatformTransactionManager manager,
            JsonMapper json, Clock clock, DSLContext dsl) {
        this.deliveries = deliveries;
        this.transactions = new TransactionTemplate(manager);
        this.json = json;
        this.clock = clock;
        this.dsl = dsl;
    }

    public void attempt(String deliveryId, boolean resetAttempts) throws Exception {
        if (resetAttempts) {
            transactions.executeWithoutResult(status -> dsl.update(HOOK_DELIVERIES)
                    .set(HOOK_DELIVERIES.STATE, "waiting")
                    .set(HOOK_DELIVERIES.ATTEMPTS, 0)
                    .set(HOOK_DELIVERIES.MANAGE_NOTIFICATIONS_URL_PRESENT, true)
                    .set(HOOK_DELIVERIES.SEND_AT, (java.time.OffsetDateTime) null)
                    .where(HOOK_DELIVERIES.ID.eq(deliveryId)).execute());
        }
        Job job = new Job(0, deliveries.name(), clock.instant(),
                json.valueToTree(Map.of("deliveryId", deliveryId, "resetAttempts", resetAttempts)), 1, null);
        HookDeliverJob.Attempt result = deliveries.call(job);
        transactions.executeWithoutResult(status -> deliveries.apply(dsl, job, result));
    }
}
