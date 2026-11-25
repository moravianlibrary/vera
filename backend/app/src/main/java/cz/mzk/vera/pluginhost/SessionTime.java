package cz.mzk.vera.pluginhost;

import java.time.Duration;
import java.time.Instant;

// PLG-api-session: a session paces itself by the machine's time, not VERA's clock, which tests and
// the testing backend may hold still.
interface SessionTime {
    SessionTime SYSTEM = new SessionTime() {
        @Override
        public long nanos() {
            return System.nanoTime();
        }

        @Override
        public Instant now() {
            return Instant.now();
        }

        @Override
        public void sleep(Duration duration) throws InterruptedException {
            Thread.sleep(duration);
        }
    };

    long nanos();

    // For a Retry-After given as a date.
    Instant now();

    void sleep(Duration duration) throws InterruptedException;
}
