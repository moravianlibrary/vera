package cz.mzk.vera.testing.control;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import org.springframework.jdbc.core.JdbcTemplate;

public final class StoredClock extends Clock {
    private final JdbcTemplate jdbc;
    private final Clock wall;

    public StoredClock(JdbcTemplate jdbc) {
        this(jdbc, Clock.systemUTC());
    }

    StoredClock(JdbcTemplate jdbc, Clock wall) {
        this.jdbc = jdbc;
        this.wall = wall;
    }

    @Override
    public ZoneId getZone() {
        return ZoneId.of("Europe/Prague");
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return Clock.offset(this, Duration.ZERO).withZone(zone);
    }

    @Override
    public Instant instant() {
        Row row = row();
        if (row == null) {
            throw new IllegalStateException("The clock is not set; reset the backend to a seed first.");
        }
        return row.at().plus(row.wallAt() == null ? Duration.ZERO : Duration.between(row.wallAt(), wall.instant()));
    }

    public boolean isFrozen() {
        Row row = row();
        return row == null || row.wallAt() == null;
    }

    public synchronized void set(Instant at) {
        Instant current = instant();
        if (at.isBefore(current)) {
            throw new ClockBackwardsException(current);
        }
        store(at, isFrozen());
    }

    public synchronized void advance(Duration amount) {
        if (amount.isNegative()) {
            throw new ClockBackwardsException();
        }
        store(instant().plus(amount), isFrozen());
    }

    public synchronized void reset(Instant at, boolean frozen) {
        store(at, frozen);
    }

    public synchronized void freeze() {
        store(instant(), true);
    }

    public synchronized void unfreeze() {
        store(instant(), false);
    }

    private void store(Instant at, boolean frozen) {
        jdbc.update(
                """
                        INSERT INTO test_clock(id, at, wall_at) VALUES (true, ?, ?)
                        ON CONFLICT (id) DO UPDATE SET at=excluded.at, wall_at=excluded.wall_at
                        """,
                Timestamp.from(at),
                frozen ? null : Timestamp.from(wall.instant()));
    }

    private Row row() {
        return jdbc.query("SELECT at, wall_at FROM test_clock WHERE id = true", result -> {
            if (!result.next()) {
                return null;
            }
            Instant wallAt = result.getTimestamp(2) == null
                    ? null
                    : result.getTimestamp(2).toInstant();
            return new Row(result.getTimestamp(1).toInstant(), wallAt);
        });
    }

    private record Row(Instant at, Instant wallAt) { }

    public static final class ClockBackwardsException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        public ClockBackwardsException() {
            super("The clock only moves forward.");
        }

        public ClockBackwardsException(Instant now) {
            super("The clock only moves forward; it is " + now + ".");
        }
    }
}
