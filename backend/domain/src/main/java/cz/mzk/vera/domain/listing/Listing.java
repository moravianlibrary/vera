package cz.mzk.vera.domain.listing;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// FILTER-slice and FILTER-group: arrange an ordered id list and count consecutive group headers.
public final class Listing {
  private Listing() {}

  public record Slice(List<String> items, String nextCursor) {
    public Slice {
      items = List.copyOf(items);
    }
  }

  public record Header(String key, int rowCount, int total) {}

  public static Slice sliceOf(List<String> orderedIds, String cursor, int limit) {
    int start = 0;
    if (cursor != null) {
      int index = orderedIds.indexOf(cursor);
      if (index < 0) {
        return new Slice(List.of(), null);
      }
      start = index + 1;
    }
    int end = Math.min(start + limit, orderedIds.size());
    List<String> items = orderedIds.subList(start, end);
    String next = end < orderedIds.size() && !items.isEmpty() ? items.getLast() : null;
    return new Slice(items, next);
  }

  public static List<Map.Entry<String, Integer>> countValues(List<String> values) {
    Map<String, Integer> counts = new LinkedHashMap<>();
    for (String value : values) {
      counts.merge(value, 1, Integer::sum);
    }
    return List.copyOf(counts.entrySet());
  }

  public static List<Header> headersOf(List<String> sliceKeys, List<String> matchingKeys) {
    List<Header> headers = new ArrayList<>();
    for (String key : sliceKeys) {
      if (!headers.isEmpty() && java.util.Objects.equals(headers.getLast().key(), key)) {
        Header last = headers.removeLast();
        headers.add(new Header(key, last.rowCount() + 1, last.total()));
      } else {
        int total = (int) matchingKeys.stream().filter(value -> java.util.Objects.equals(value, key)).count();
        headers.add(new Header(key, 1, total));
      }
    }
    return List.copyOf(headers);
  }
}
