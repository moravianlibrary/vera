package cz.mzk.vera.domain.properties;

import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import cz.mzk.vera.domain.entities.PropertyCondition;

// DOC-property-types, DOC-property-hand, DOC-property-values, DOC-property-filter,
// PERM-property-edit.
public final class Properties {
  private Properties() {}

  public enum PropertyKind {
    Text("text"), Number("number"), Date("date"), Enum("enum"), YesNo("yesNo");

    private final String wireName;

    PropertyKind(String wireName) {
      this.wireName = wireName;
    }

    public String wireName() {
      return wireName;
    }
  }

  public record Definition(
      String key,
      PropertyKind kind,
      String unit,
      boolean isList,
      List<String> enumValues,
      Map<String, String> enumNames,
      boolean isCatalogFact) {}

  public record Source(
      String kind,
      String instanceId,
      String instanceName,
      int tier,
      Object value,
      String observedAt,
      String setBy) {}

  public record PropertyValues(String key, List<Source> sources) {}

  // mayBeEnteredByHand: DOC-property-hand; catalog facts are hand-entered only for page count.
  public static boolean mayBeEnteredByHand(String key, boolean isCatalogFact) {
    return !isCatalogFact || key.equals("page_count");
  }

  // sourcesByTierOf: DOC-property-values; highest tier comes first.
  public static List<Source> sourcesByTierOf(List<Source> sources) {
    return sources.stream().sorted(Comparator.comparingInt(Source::tier).reversed()).toList();
  }

  // valuesOf: DOC-property-values; return the entry with the requested stable key.
  public static PropertyValues valuesOf(List<PropertyValues> properties, String key) {
    return properties.stream().filter(item -> item.key().equals(key)).findFirst().orElse(null);
  }

  // valueInUseOf: DOC-property-values; the highest tier with a value wins.
  public static Source valueInUseOf(List<Source> sources) {
    return sourcesByTierOf(sources).stream().findFirst().orElse(null);
  }

  // valueInUseAt: PLAN-scope; only values observed by the requested instant are considered.
  public static Source valueInUseAt(List<Source> sources, String at) {
    return valueInUseOf(
        sources.stream().filter(source -> source.observedAt().compareTo(at) <= 0).toList());
  }

  // isValueOf: DOC-property-types; the scalar type and list shape must match.
  public static boolean isValueOf(Definition definition, Object value) {
    boolean list = value instanceof List<?>;
    if (list != definition.isList()) {
      return false;
    }
    List<?> values = list ? (List<?>) value : List.of(value);
    return !values.isEmpty() && values.stream().allMatch(item -> scalarMatches(definition, item));
  }

  // scalarMatches: DOC-property-types; validate one scalar according to the definition.
  private static boolean scalarMatches(Definition definition, Object value) {
    return switch (definition.kind()) {
      case Text -> value instanceof String text && !text.trim().isEmpty();
      case Number -> value instanceof Number number && Double.isFinite(number.doubleValue());
      case YesNo -> value instanceof Boolean;
      case Date -> value instanceof String text && text.matches("\\d{4}-\\d{2}-\\d{2}");
      case Enum -> definition.enumValues().contains(String.valueOf(value));
      default -> false;
    };
  }

  // formatPropertyValue: DOC-property-types; render scalar values using the definition.
  public static String formatPropertyValue(Definition definition, Object value) {
    List<?> values = value instanceof List<?> list ? list : List.of(value);
    return values.stream()
        .map(item -> formatScalar(definition, item))
        .reduce((a, b) -> a + ", " + b)
        .orElse("");
  }

  // formatScalar: DOC-property-types; format one value according to its property type.
  private static String formatScalar(Definition definition, Object value) {
    if (definition.kind() == PropertyKind.YesNo) {
      return Boolean.TRUE.equals(value) ? "Yes" : "No";
    }
    if (definition.kind() == PropertyKind.Enum) {
      return definition.enumNames().getOrDefault(String.valueOf(value), String.valueOf(value));
    }
    if (definition.kind() == PropertyKind.Number) {
      DecimalFormat format =
          new DecimalFormat("#,##0.###", DecimalFormatSymbols.getInstance(Locale.UK));
      format.setRoundingMode(RoundingMode.HALF_UP);
      String number = format.format(((Number) value).doubleValue());
      return definition.unit().isEmpty() ? number : number + " " + definition.unit();
    }
    return String.valueOf(value);
  }

  // isActiveCondition: DOC-property-filter; an empty condition does not filter.
  public static boolean isActiveCondition(PropertyCondition condition) {
    if (Boolean.TRUE.equals(condition.hasNoValue())) {
      return true;
    }
    for (String key : List.of("contains", "startsWith", "endsWith")) {
      Object value = conditionValue(condition, key);
      if (value instanceof String text && !text.trim().isEmpty()) {
        return true;
      }
    }
    Object any = condition.anyOf();
    return condition.numberRange() != null
        || condition.dayRange() != null
        || any instanceof List<?> list && !list.isEmpty();
  }

  // facetValueOf: DOC-property-filter; facets use Yes/No for booleans.
  public static String facetValueOf(Object scalar) {
    return scalar instanceof Boolean value ? value ? "Yes" : "No" : String.valueOf(scalar);
  }

  // meetsCondition: DOC-property-filter; every requested dimension must match some scalar in a
  // list.
  public static boolean meetsCondition(PropertyCondition condition, Object value, String today) {
    if (value == null) {
      return Boolean.TRUE.equals(condition.hasNoValue());
    }
    List<?> scalars = value instanceof List<?> list ? list : List.of(value);
    boolean asked = false;
    for (String key : List.of("contains", "startsWith", "endsWith")) {
      Object raw = conditionValue(condition, key);
      if (raw instanceof String text && !text.trim().isEmpty()) {
        asked = true;
        String wanted = text.trim().toLowerCase(Locale.ROOT);
        boolean found =
            scalars.stream().anyMatch(item -> textMatch(key, String.valueOf(item), wanted));
        if (!found) {
          return false;
        }
      }
    }
    if (condition.anyOf() != null && !condition.anyOf().isEmpty()) {
      List<String> choices = condition.anyOf();
      asked = true;
      if (scalars.stream().noneMatch(item -> choices.contains(facetValueOf(item)))) {
        return false;
      }
    }
    if (condition.numberRange() != null) {
      asked = true;
      if (scalars.stream()
          .noneMatch(item -> item instanceof Number number
              && numberWithin(number.doubleValue(), condition.numberRange())))
        return false;
    }
    if (condition.dayRange() != null) {
      asked = true;
      if (scalars.stream()
          .noneMatch(item -> item instanceof String text
              && dayWithin(text, condition.dayRange(), today)))
        return false;
    }
    return asked;
  }

  // textMatch: meetsCondition, DOC-property-filter; apply the selected case-insensitive text test.
  private static boolean textMatch(String key, String value, String wanted) {
    String text = value.toLowerCase(Locale.ROOT);
    return switch (key) {
      case "startsWith" -> text.startsWith(wanted);
      case "endsWith" -> text.endsWith(wanted);
      default -> text.contains(wanted);
    };
  }

  // numberWithin: meetsCondition, DOC-property-filter; include both supplied range bounds.
  private static boolean numberWithin(double value, Map<?, ?> range) {
    Object from = range.get("from");
    Object to = range.get("to");
    return (!(from instanceof Number lower) || value >= lower.doubleValue())
        && (!(to instanceof Number upper) || value <= upper.doubleValue());
  }

  // dayWithin: meetsCondition, DOC-property-filter; resolve calendar presets against today.
  private static boolean dayWithin(String value, Map<?, ?> range, String today) {
    String from = range.get("from") instanceof String text ? text : null;
    String to = range.get("to") instanceof String text ? text : null;
    if (range.get("preset") instanceof String preset) {
      LocalDate date = LocalDate.parse(today);
      switch (preset) {
        case "last-7-days" -> {
          from = date.minusDays(6).toString();
          to = today;
        }
        case "last-14-days" -> {
          from = date.minusDays(13).toString();
          to = today;
        }
        case "last-30-days" -> {
          from = date.minusDays(29).toString();
          to = today;
        }
        case "this-week" -> {
          from = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).toString();
          to = date.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY)).toString();
        }
        case "last-week" -> {
          LocalDate lastWeek = date.minusDays(7);
          from = lastWeek.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).toString();
          to = lastWeek.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY)).toString();
        }
        case "next-week" -> {
          LocalDate nextWeek = date.plusDays(7);
          from = nextWeek.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).toString();
          to = nextWeek.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY)).toString();
        }
        case "this-month" -> {
          from = date.withDayOfMonth(1).toString();
          to = date.with(TemporalAdjusters.lastDayOfMonth()).toString();
        }
        case "last-month" -> {
          LocalDate lastMonth = date.minusMonths(1);
          from = lastMonth.withDayOfMonth(1).toString();
          to = lastMonth.with(TemporalAdjusters.lastDayOfMonth()).toString();
        }
        case "next-month" -> {
          LocalDate nextMonth = date.plusMonths(1);
          from = nextMonth.withDayOfMonth(1).toString();
          to = nextMonth.with(TemporalAdjusters.lastDayOfMonth()).toString();
        }
        default -> {
          return false;
        }
      }
    }
    return (from == null || value.compareTo(from) >= 0) && (to == null || value.compareTo(to) <= 0);
  }

  // editPermissionOf: PERM-property-edit; each property has its own permission.
  public static String editPermissionOf(String key) {
    return "property." + key + ".edit";
  }

  // propertyKeyOfPermission: PERM-property-edit; accept only a well-formed property edit key.
  public static String propertyKeyOfPermission(String permission) {
    Matcher matcher = Pattern.compile("^property\\.([a-z][a-z0-9_]*)\\.edit$").matcher(permission);
    return matcher.matches() ? matcher.group(1) : null;
  }

  // withTextCondition: DOC-property-filter; retain only the selected text operator.
  public static PropertyCondition withTextCondition(
      PropertyCondition condition, String match, String text) {
    String normalized = text.trim().isEmpty() ? null : text;
    return new PropertyCondition(condition.key(), condition.hasNoValue(),
        match.equals("contains") ? normalized : null,
        match.equals("startsWith") ? normalized : null,
        match.equals("endsWith") ? normalized : null, condition.numberRange(),
        condition.dayRange(), condition.anyOf());
  }

  // textSummaryOf: DOC-property-filter; summarize the active text condition for display.
  public static String textSummaryOf(PropertyCondition condition) {
    for (String key : List.of("contains", "startsWith", "endsWith")) {
      Object value = conditionValue(condition, key);
      if (value instanceof String text && !text.trim().isEmpty()) {
        String label =
            switch (key) {
              case "startsWith" -> "starts with";
              case "endsWith" -> "ends with";
              default -> "contains";
            };
        return label + " “" + text.trim() + "”";
      }
    }
    return null;
  }

  private static Object conditionValue(PropertyCondition condition, String key) {
    return switch (key) {
      case "contains" -> condition.contains();
      case "startsWith" -> condition.startsWith();
      case "endsWith" -> condition.endsWith();
      default -> null;
    };
  }
}
