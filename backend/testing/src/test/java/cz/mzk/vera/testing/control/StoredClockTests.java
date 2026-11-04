package cz.mzk.vera.testing.control;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Testcontainers
class StoredClockTests {
    private static final Instant SEED_MOMENT = Instant.parse("2026-06-25T08:40:00Z");
    @Container
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");
    private StoredClock clock;
    private MutableWallClock wall;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource source = new DriverManagerDataSource(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        JdbcTemplate jdbc = new JdbcTemplate(source);
        jdbc.execute("DROP TABLE IF EXISTS test_clock");
        jdbc.execute("""
                CREATE TABLE test_clock (
                  id boolean PRIMARY KEY DEFAULT true CHECK (id),
                  at timestamptz NOT NULL,
                  wall_at timestamptz
                )
                """);
        wall = new MutableWallClock(Instant.parse("2026-06-25T08:00:00Z"));
        clock = new StoredClock(jdbc, wall);
    }

    @Test
    @DisplayName("is not set before a reset")
    void isNotSetBeforeAReset() {
        assertThrows(IllegalStateException.class, clock::instant);
    }

    @Test
    @DisplayName("stands still while frozen")
    void standsStillWhileFrozen() {
        clock.reset(SEED_MOMENT, true);
        wall.advance(Duration.ofMinutes(1));
        assertEquals(SEED_MOMENT, clock.instant());
        assertTrue(clock.isFrozen());
    }

    @Test
    @DisplayName("moves on with the wall clock while running")
    void movesOnWithTheWallClockWhileRunning() {
        clock.reset(SEED_MOMENT, false);
        wall.advance(Duration.ofMinutes(1));
        assertEquals(SEED_MOMENT.plusSeconds(60), clock.instant());
    }

    @Test
    @DisplayName("is set or advanced forward only")
    void isSetOrAdvancedForwardOnly() {
        clock.reset(SEED_MOMENT, true);
        clock.advance(Duration.ofDays(1));
        assertEquals(Instant.parse("2026-06-26T08:40:00Z"), clock.instant());
        clock.set(Instant.parse("2026-07-01T00:00:00Z"));
        assertEquals(Instant.parse("2026-07-01T00:00:00Z"), clock.instant());
        assertThrows(StoredClock.ClockBackwardsException.class, () -> clock.set(SEED_MOMENT));
        assertThrows(StoredClock.ClockBackwardsException.class, () -> clock.advance(Duration.ofMillis(-1)));
    }

    @Test
    @DisplayName("keeps its moment when frozen or unfrozen")
    void keepsItsMomentWhenFrozenOrUnfrozen() {
        clock.reset(SEED_MOMENT, false);
        wall.advance(Duration.ofSeconds(1));
        clock.freeze();
        Instant held = clock.instant();
        wall.advance(Duration.ofSeconds(5));
        assertEquals(held, clock.instant());
        clock.unfreeze();
        wall.advance(Duration.ofSeconds(1));
        assertEquals(held.plusSeconds(1), clock.instant());
    }

    private static final class MutableWallClock extends Clock {
        private final AtomicReference<Instant> now;

        MutableWallClock(Instant initial) {
            now = new AtomicReference<>(initial);
        }

        void advance(Duration amount) {
            now.updateAndGet(instant -> instant.plus(amount));
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return Clock.fixed(instant(), zone);
        }

        @Override
        public Instant instant() {
            return now.get();
        }
    }
}
