package cz.mzk.vera.intentions;

import cz.mzk.vera.domain.intentions.Intentions.RepeatPeriod;
import java.time.LocalDate;
import java.time.temporal.IsoFields;
import java.time.temporal.TemporalAdjusters;
import java.time.DayOfWeek;
import java.time.Month;
import java.time.format.TextStyle;
import java.util.Locale;

// LC-INT-repeat: names use fixed English period labels; bounds include the entire period.
public final class RepeatPeriods {
    private RepeatPeriods() {}

    public static Period of(RepeatPeriod period, LocalDate date) {
        return switch (period) {
            case week -> {
                LocalDate start = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                yield new Period(start, start.plusDays(6), weekName(start));
            }
            case month -> {
                LocalDate start = date.withDayOfMonth(1);
                yield new Period(start, start.with(TemporalAdjusters.lastDayOfMonth()), monthName(start));
            }
            case quarter -> {
                int firstMonth = ((date.getMonthValue() - 1) / 3) * 3 + 1;
                LocalDate start = LocalDate.of(date.getYear(), firstMonth, 1);
                yield new Period(start, start.plusMonths(3).minusDays(1), quarterName(start));
            }
        };
    }

    private static String weekName(LocalDate start) {
        return "Week " + start.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR) + ", "
                + start.get(IsoFields.WEEK_BASED_YEAR);
    }

    private static String monthName(LocalDate start) {
        return Month.of(start.getMonthValue()).getDisplayName(TextStyle.FULL, Locale.ENGLISH)
                + " " + start.getYear();
    }

    private static String quarterName(LocalDate start) {
        return "Q" + (((start.getMonthValue() - 1) / 3) + 1) + " " + start.getYear();
    }

    public record Period(LocalDate startsOn, LocalDate endsOn, String name) {}
}
