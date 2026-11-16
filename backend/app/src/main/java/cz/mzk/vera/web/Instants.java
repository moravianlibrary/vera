package cz.mzk.vera.web;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/** Keeps wire instants in the millisecond ISO format. */
public final class Instants {
    private Instants() {}

    public static String format(Instant instant) {
        return DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSS'Z'")
                .withZone(ZoneOffset.UTC).format(instant);
    }
}
