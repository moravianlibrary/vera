package cz.mzk.vera.session;

import java.util.List;

// ACT-local-account: generated record IDs use the greatest numeric suffix for their prefix.
public final class RecordIds {
    private RecordIds() {}

    public static String next(String prefix, List<String> ids) {
        int max = ids.stream()
                .filter(id -> id.startsWith(prefix))
                .map(id -> id.substring(prefix.length()))
                .mapToInt(suffix -> {
                    try {
                        return Integer.parseInt(suffix);
                    } catch (NumberFormatException ignored) {
                        return 0;
                    }
                })
                .max()
                .orElse(0);
        return prefix + (max + 1);
    }
}
