package cz.mzk.vera.domain.valuerange;

import java.time.DateTimeException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.function.Function;
import java.util.regex.Pattern;

// FILTER-range: inclusive URL ranges and calendar presets resolve in Europe/Prague's LocalDate.
public final class ValueRange {
  private static final Pattern COUNT = Pattern.compile("\\d+");
  private static final Pattern DAY = Pattern.compile("\\d{4}-\\d{2}-\\d{2}");
  public enum DayPreset {
    Last7Days("last-7-days"),
    Last14Days("last-14-days"),
    Last30Days("last-30-days"),
    ThisWeek("this-week"),
    LastWeek("last-week"),
    NextWeek("next-week"),
    ThisMonth("this-month"),
    LastMonth("last-month"),
    NextMonth("next-month");

    private final String wireName;

    DayPreset(String wireName) {
      this.wireName = wireName;
    }

    public String wireName() {
      return wireName;
    }

    public static DayPreset of(String raw) {
      for (DayPreset preset : values()) {
        if (preset.wireName.equals(raw)) {
          return preset;
        }
      }
      return null;
    }
  }

  public static final List<DayPreset> DAY_PRESETS = List.of(DayPreset.values());
  public static final List<DayPreset> RECENT_DAY_PRESETS =
      List.of(DayPreset.Last7Days, DayPreset.Last14Days, DayPreset.Last30Days, DayPreset.ThisMonth);
  private ValueRange() {
  }

  public static <T> String formatRange(Range<T> range) {
    if (range == null || range.from() == null && range.to() == null) {
      return null;
    }
    return (range.from() == null ? "" : range.from().toString()) + ".."
        + (range.to() == null ? "" : range.to().toString());
  }

  public static boolean isOpenRange(Range<?> range) {
    return range.from() == null && range.to() == null;
  }

  public static boolean isDayPreset(DayRange range) {
    return range.preset() != null;
  }

  public static String dayOf(LocalDate day) {
    return day.toString();
  }

  public static Long parseCount(String raw) {
    return raw != null && COUNT.matcher(raw).matches() ? Long.valueOf(raw) : null;
  }

  public static LocalDate parseDay(String raw) {
    if (raw == null || !DAY.matcher(raw).matches()) {
      return null;
    }
    try {
      return LocalDate.parse(raw);
    } catch (DateTimeException exception) {
      return null;
    }
  }

  public static <T> Range<T> parseRange(String raw, Function<String, T> parseValue) {
    if (raw == null || !raw.contains("..")) {
      return null;
    }
    String[] parts = raw.split("\\.\\.", -1);
    if (parts.length != 2) {
      return null;
    }
    String from = parts[0].trim();
    String to = parts[1].trim();
    if (from.isEmpty() && to.isEmpty()) {
      return null;
    }
    T parsedFrom = from.isEmpty() ? null : parseValue.apply(from);
    T parsedTo = to.isEmpty() ? null : parseValue.apply(to);
    if (!from.isEmpty() && parsedFrom == null || !to.isEmpty() && parsedTo == null) {
      return null;
    }
    return new Range<>(parsedFrom, parsedTo);
  }

  public static boolean isWithinRange(long value, Range<Long> range) {
    return (range.from() == null || value >= range.from()) && (range.to() == null || value <= range.to());
  }

  public static boolean isWithinRange(String value, Range<String> range) {
    return (range.from() == null || value.compareTo(range.from()) >= 0)
        && (range.to() == null || value.compareTo(range.to()) <= 0);
  }

  public static <T extends Comparable<? super T>> boolean isReversedRange(Range<T> range) {
    return range.from() != null && range.to() != null && range.from().compareTo(range.to()) > 0;
  }

  public static Range<String> lastDaysRange(LocalDate today, int count) {
    return new Range<>(today.minusDays(count - 1L).toString(), today.toString());
  }

  public static Range<String> monthRange(LocalDate today) {
    YearMonth month = YearMonth.from(today);
    return new Range<>(month.atDay(1).toString(), month.atEndOfMonth().toString());
  }

  public static Range<String> weekRange(LocalDate today) {
    LocalDate first = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    return new Range<>(first.toString(), first.plusDays(6).toString());
  }

  public static String formatDayRange(DayRange range) {
    return range.preset() != null ? range.preset().wireName() : formatRange(range.range());
  }

  public static DayRange parseDayRange(String raw) {
    DayPreset preset = DayPreset.of(raw);
    if (preset != null) {
      return new DayRange(null, preset);
    }
    Range<LocalDate> value = parseRange(raw, ValueRange::parseDay);
    if (value == null) {
      return null;
    }
    return new DayRange(value, null);
  }

  public static Range<String> resolveDayRange(DayRange range, LocalDate today) {
    if (range.preset() == null) {
      String from = range.range().from() == null ? null : range.range().from().toString();
      String to = range.range().to() == null ? null : range.range().to().toString();
      return new Range<>(from, to);
    }
    return switch (range.preset()) {
      case Last7Days -> lastDaysRange(today, 7);
      case Last14Days -> lastDaysRange(today, 14);
      case Last30Days -> lastDaysRange(today, 30);
      case ThisWeek -> weekRange(today);
      case LastWeek -> weekRange(today.minusWeeks(1));
      case NextWeek -> weekRange(today.plusWeeks(1));
      case ThisMonth -> monthRange(today);
      case LastMonth -> monthRange(today.minusMonths(1));
      case NextMonth -> monthRange(today.plusMonths(1));
    };
  }
}
