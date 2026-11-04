package cz.mzk.vera.events;

import java.util.UUID;

// LOG-one-act-one-story.
public final class Correlation {
    private Correlation() {}

    public static String newId() {
        return UUID.randomUUID().toString();
    }
}
