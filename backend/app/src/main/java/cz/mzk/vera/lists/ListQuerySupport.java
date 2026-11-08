package cz.mzk.vera.lists;

import java.util.LinkedHashMap;
import java.util.Map;

// VIEW-lists; shared response and query values.
final class ListQuerySupport {
    private ListQuerySupport() {}

    static Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < values.length; index += 2) {
            result.put((String) values[index], values[index + 1]);
        }
        return result;
    }

    static String trim(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }
}
