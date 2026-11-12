package cz.mzk.vera.watchlists;

// WATCH-push; RFC 8291 encrypted Web Push is provided by web-push-java.
public interface PushSender {
    int send(String endpoint, String p256dh, String auth, String payload) throws Exception;
}
