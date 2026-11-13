package cz.mzk.vera.domain;

import java.util.Map;

// UI-names: a record's name in the viewer's language, or in the other one; domain/src/names.ts.
public final class Names {
    private Names() {}

    public static String nameIn(Map<String, String> names, String language) {
        String preferred = names.get(language);
        if (preferred != null) {
            return preferred;
        }
        String fallback = names.get("cs".equals(language) ? "en" : "cs");
        return fallback == null ? "" : fallback;
    }
}
