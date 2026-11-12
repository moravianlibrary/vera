package cz.mzk.vera.watchlists;

import java.nio.charset.StandardCharsets;
import java.security.Security;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

// WATCH-push; decision 7. web-push-java handles VAPID and RFC 8291 encryption.
@Component
public final class RealPushSender implements PushSender {
    private final String publicKey;
    private final String privateKey;
    private final String subject;

    public RealPushSender(@Value("${vera.push.vapid-public-key}") String publicKey,
            @Value("${vera.push.vapid-private-key}") String privateKey,
            @Value("${vera.push.subject}") String subject) {
        this.publicKey = publicKey;
        this.privateKey = privateKey;
        this.subject = subject;
        Security.addProvider(new BouncyCastleProvider());
    }

    @Override
    public int send(String endpoint, String p256dh, String auth, String payload) throws Exception {
        PushService service = new PushService(publicKey, privateKey, subject);
        Notification notification = new Notification(endpoint, p256dh, auth,
                payload.getBytes(StandardCharsets.UTF_8), 60);
        return service.send(notification).getStatusLine().getStatusCode();
    }
}
