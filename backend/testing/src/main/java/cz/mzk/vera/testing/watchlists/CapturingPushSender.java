package cz.mzk.vera.testing.watchlists;

import cz.mzk.vera.events.Outbox;
import cz.mzk.vera.watchlists.PushSender;
import java.util.Map;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

// WATCH-push: the test profile captures push deliveries in the backend outbox, in place of the real sender.
@Component
@Primary
@Profile("test")
public final class CapturingPushSender implements PushSender {
    private final Outbox outbox;
    private final JsonMapper mapper = new JsonMapper();

    public CapturingPushSender(Outbox outbox) {
        this.outbox = outbox;
    }

    @Override
    public int send(String endpoint, String p256dh, String auth, String payload) {
        if (endpoint.endsWith("/gone")) {
            return 410;
        }
        outbox.send("push", endpoint, mapper.valueToTree(Map.of("payload", payload)));
        return 201;
    }
}
