package cz.mzk.vera.domain.schedules;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Map;

// ENT-schedule; LC-INT-repeat.
public final class Schedules {
  private Schedules() {}

  public static Map<String, Object> repeatCadenceOf(String every) {
    return switch (every) {
      case "week" -> Map.of("every", "week", "weekday", 1, "at", "00:00");
      case "month" -> Map.of("every", "month", "day", 1, "at", "00:00");
      case "quarter" -> Map.of("every", "quarter", "at", "00:00");
      default -> throw new IllegalArgumentException("Unknown repeat cadence: " + every);
    };
  }

  // The next moment strictly after the input; task schedule instants are stored in UTC.
  public static Instant nextOccurrenceOf(Map<String, Object> cadence, Instant after) {
    return nextOccurrenceOf(cadence, after, ZoneOffset.UTC);
  }

  public static Instant nextOccurrenceOf(Map<String, Object> cadence, Instant after, ZoneId zone) {
    String every = cadence.get("every").toString();
    LocalDateTime start = LocalDateTime.ofInstant(after, zone).plusNanos(1_000_000);
    LocalDate day = start.toLocalDate();
    if (every.equals("minutes") || every.equals("hours")) {
      int step = ((Number) cadence.get("interval")).intValue() * (every.equals("hours") ? 60 : 1);
      LocalDateTime midnight = day.atStartOfDay();
      long minutes = ChronoUnit.MINUTES.between(midnight, start);
      long next = ((minutes / step) + 1) * step;
      return midnight.plusMinutes(next).atZone(zone).toInstant();
    }
    LocalTime at = LocalTime.parse(cadence.get("at").toString());
    for (int offset = 0; offset < 100; offset++) {
      LocalDate candidateDay = day.plusDays(offset);
      boolean due = switch (every) {
        case "day" -> true;
        case "week" -> candidateDay.getDayOfWeek().getValue() % 7
            == ((Number) cadence.get("weekday")).intValue();
        case "month" -> candidateDay.getDayOfMonth() == ((Number) cadence.get("day")).intValue();
        case "quarter" -> candidateDay.getDayOfMonth() == 1
            && (candidateDay.getMonthValue() - 1) % 3 == 0;
        default -> false;
      };
      LocalDateTime candidate = candidateDay.atTime(at);
      if (due && candidate.isAfter(start)) {
        return candidate.atZone(zone).toInstant();
      }
    }
    return null;
  }
}
