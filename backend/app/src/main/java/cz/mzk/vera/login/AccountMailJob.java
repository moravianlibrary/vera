package cz.mzk.vera.login;

import static cz.mzk.vera.db.tables.Tables.OUTBOX;

import cz.mzk.vera.jobs.Job;
import cz.mzk.vera.jobs.JobKind;
import cz.mzk.vera.jobs.Jobs;
import cz.mzk.vera.plugin.deliverychannel.DeliveryChannel;
import cz.mzk.vera.plugin.deliverychannel.SendInput;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
import cz.mzk.vera.web.PublicUrl;
import java.time.Clock;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// ACCESS-sign-up; ACCESS-password-reset. Account mail is recorded before it is delivered.
@Component
public final class AccountMailJob implements JobKind<AccountMailJob.Attempt> {
    private static final Logger LOGGER = LoggerFactory.getLogger(AccountMailJob.class);
    private static final int MAX_ATTEMPTS = 8;

    private final DSLContext dsl;
    private final IdentityInstances instances;
    private final PluginCalls calls;
    private final PublicUrl publicUrl;
    private final Jobs jobs;
    private final Clock clock;
    private final JsonMapper json;

    public AccountMailJob(DSLContext dsl, IdentityInstances instances, PluginCalls calls,
            PublicUrl publicUrl, Jobs jobs, Clock clock, JsonMapper json) {
        this.dsl = dsl;
        this.instances = instances;
        this.calls = calls;
        this.publicUrl = publicUrl;
        this.jobs = jobs;
        this.clock = clock;
        this.json = json;
    }

    @Override
    public String name() {
        return "account.mail";
    }

    @Override
    public Attempt call(Job job) {
        long outboxId = job.payload().path("outboxId").asLong();
        String instanceId = job.payload().path("instanceId").asString();
        Record row = dsl.selectFrom(OUTBOX).where(OUTBOX.ID.eq(outboxId)).fetchOne();
        if (row == null || !"account".equals(row.get(OUTBOX.CHANNEL))) {
            return new Attempt(outboxId, instanceId, null, false, false);
        }
        IdentityInstances.Instance instance = instances.find(instanceId);
        if (instance == null || !instances.hasMailChannel(instanceId)) {
            LOGGER.warn("Account mail {} has no enabled mail channel on instance {}", outboxId, instanceId);
            return new Attempt(outboxId, instanceId, null, false, false);
        }
        String channelId = instance.configuration().path("mail_channel").asString();
        var payload = row.get(OUTBOX.PAYLOAD);
        var mail = new LinkedHashMap<String, Object>();
        JsonNode content = json.readTree(payload.data());
        String link = publicUrl.value().replaceAll("/$", "") + content.path("link").asString();
        String subject = content.path("subject").asString();
        mail.put("subject", subject);
        mail.put("link", link);
        mail.put("text", text(subject, link));
        PluginOutcome<?> outcome = calls.call(channelId, DeliveryChannel.class, "send",
                (delivery, context) -> delivery.send(context,
                        new SendInput(row.get(OUTBOX.RECIPIENT), mail)));
        if (outcome instanceof PluginOutcome.Answered<?>) {
            return new Attempt(outboxId, instanceId, null, true, false);
        }
        if (outcome instanceof PluginOutcome.Refused<?>) {
            return new Attempt(outboxId, instanceId, null, false, false);
        }
        int attempt = job.payload().path("attempt").asInt(job.attempt());
        return new Attempt(outboxId, instanceId, "unavailable", false, attempt < MAX_ATTEMPTS);
    }

    @Override
    public void apply(DSLContext tx, Job job, Attempt attempt) {
        if (attempt.retry()) {
            int number = job.payload().path("attempt").asInt(job.attempt());
            long minutes = 1L << Math.min(10, number - 1);
            jobs.enqueue(tx, name(), clock.instant().plus(Duration.ofMinutes(minutes)),
                    Map.of("outboxId", attempt.outboxId(), "instanceId", attempt.instanceId(), "attempt", number + 1));
        }
    }

    private String text(String subject, String link) {
        String sentence = switch (subject) {
            case SignUpCommands.VERIFY_SUBJECT -> "Verify your email using this link: ";
            case SignUpCommands.RESET_SUBJECT -> "Set a new password using this link: ";
            default -> "Continue to your account using this link: ";
        };
        return sentence + link;
    }

    public record Attempt(long outboxId, String instanceId, String detail, boolean sent, boolean retry) {}
}
