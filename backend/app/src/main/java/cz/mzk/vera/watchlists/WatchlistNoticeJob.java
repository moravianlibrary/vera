package cz.mzk.vera.watchlists;

import cz.mzk.vera.account.AccountQueries;
import cz.mzk.vera.jobs.Job;
import cz.mzk.vera.jobs.JobKind;
import cz.mzk.vera.plugin.deliverychannel.DeliveryChannel;
import cz.mzk.vera.plugin.deliverychannel.SendInput;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
import java.util.LinkedHashMap;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// WATCH-system-change. Notices go through the subscribed Delivery channel.
@Component
public final class WatchlistNoticeJob implements JobKind<WatchlistNoticeJob.NoticeAttempt> {
    private final AccountQueries account;
    private final PluginCalls calls;
    private final JsonMapper json;

    public WatchlistNoticeJob(AccountQueries account, PluginCalls calls, JsonMapper json) {
        this.account = account;
        this.calls = calls;
        this.json = json;
    }

    @Override
    public String name() {
        return "watchlist.notice";
    }

    @Override
    public NoticeAttempt call(Job job) {
        String userId = job.payload().path("userId").asString();
        String watchlistId = job.payload().path("watchlistId").asString();
        String channelId = job.payload().path("channelId").asString();
        JsonNode notifications = account.settings(userId).path("notifications");
        if (notifications.path("doNotSend").asBoolean() || contains(notifications.path("channelsOff"), channelId)) {
            return new NoticeAttempt(false);
        }
        String recipient = job.payload().path("recipient").asString();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("schema", "vera.watchlist-notice/1");
        payload.put("watchlistId", watchlistId);
        payload.put("watchlistName", job.payload().path("name").asString());
        payload.put("reason", job.payload().path("reason").asString());
        payload.put("manageUrl", job.payload().path("manageUrl").asString());
        PluginOutcome<?> outcome = calls.call(channelId, DeliveryChannel.class, "send",
                (delivery, context) -> delivery.send(context, new SendInput(recipient, payload)));
        return new NoticeAttempt(outcome instanceof PluginOutcome.Answered<?>);
    }

    @Override
    public void apply(DSLContext tx, Job job, NoticeAttempt attempt) {
        // The channel owns its outbox, so no second delivery record is written here.
    }

    private boolean contains(JsonNode values, String value) {
        for (JsonNode item : values) {
            if (value.equals(item.asString())) {
                return true;
            }
        }
        return false;
    }

    public record NoticeAttempt(boolean sent) {}
}
