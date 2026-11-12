package cz.mzk.vera.watchlists;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

// WATCH-manage-link. The key is configuration and is never logged.
@Component
public final class WatchlistManageLinks {
    private final Clock clock;
    private final byte[] key;

    public WatchlistManageLinks(Clock clock, @Value("${vera.watchlists.link-key}") String key) {
        this.clock = clock;
        this.key = key.getBytes(StandardCharsets.UTF_8);
        if (this.key.length < 32) {
            throw new IllegalArgumentException("Watchlist link key must contain at least 32 bytes");
        }
    }

    public String issue(String userId, String watchlistId) {
        Instant expires = clock.instant().plus(Duration.ofDays(30));
        String value = userId + "\n" + watchlistId + "\n" + expires.getEpochSecond();
        String payload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
        return payload + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(sign(payload));
    }

    public Link verify(String token) {
        if (token == null || token.length() > 2048) {
            return null;
        }
        String[] parts = token.split("\\.", -1);
        if (parts.length != 2) {
            return null;
        }
        byte[] supplied;
        try {
            supplied = Base64.getUrlDecoder().decode(parts[1]);
        } catch (IllegalArgumentException exception) {
            return null;
        }
        if (!MessageDigest.isEqual(sign(parts[0]), supplied)) {
            return null;
        }
        try {
            String[] values = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8)
                    .split("\\n", -1);
            if (values.length != 3 || Long.parseLong(values[2]) <= clock.instant().getEpochSecond()) {
                return null;
            }
            return new Link(values[0], values[1], Instant.ofEpochSecond(Long.parseLong(values[2])));
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private byte[] sign(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("HMAC-SHA256 is unavailable", exception);
        }
    }

    public record Link(String userId, String watchlistId, Instant expiresAt) {}
}
