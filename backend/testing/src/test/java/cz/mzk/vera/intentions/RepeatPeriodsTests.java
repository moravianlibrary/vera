package cz.mzk.vera.intentions;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.domain.intentions.Intentions.RepeatPeriod;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

// LC-INT-repeat: each repeat period has a stable name and inclusive calendar bounds.
class RepeatPeriodsTests {
    @Test
    void monthIncludesItsLastDayAtYearEnd() {
        assertThat(RepeatPeriods.of(RepeatPeriod.month, LocalDate.of(2026, 12, 31)))
                .isEqualTo(new RepeatPeriods.Period(
                        LocalDate.of(2026, 12, 1), LocalDate.of(2026, 12, 31), "December 2026"));
    }

    @Test
    void yearEndDateUsesTheFollowingIsoWeekBasedYear() {
        assertThat(RepeatPeriods.of(RepeatPeriod.week, LocalDate.of(2021, 1, 1)))
                .isEqualTo(new RepeatPeriods.Period(
                        LocalDate.of(2020, 12, 28), LocalDate.of(2021, 1, 3), "Week 53, 2020"));
    }

    @Test
    void isoWeekOneUsesItsWeekBasedYear() {
        assertThat(RepeatPeriods.of(RepeatPeriod.week, LocalDate.of(2026, 1, 1)))
                .isEqualTo(new RepeatPeriods.Period(
                        LocalDate.of(2025, 12, 29), LocalDate.of(2026, 1, 4), "Week 1, 2026"));
    }

    @Test
    void weekFiftyThreeUsesItsWeekBasedYear() {
        assertThat(RepeatPeriods.of(RepeatPeriod.week, LocalDate.of(2026, 12, 31)))
                .isEqualTo(new RepeatPeriods.Period(
                        LocalDate.of(2026, 12, 28), LocalDate.of(2027, 1, 3), "Week 53, 2026"));
    }

    @Test
    void ordinaryWeekUsesIsoWeekNumber() {
        assertThat(RepeatPeriods.of(RepeatPeriod.week, LocalDate.of(2026, 6, 3)))
                .isEqualTo(new RepeatPeriods.Period(
                        LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 7), "Week 23, 2026"));
    }

    @Test
    void quarterIncludesTheQuarterEnd() {
        assertThat(RepeatPeriods.of(RepeatPeriod.quarter, LocalDate.of(2026, 6, 30)))
                .isEqualTo(new RepeatPeriods.Period(
                        LocalDate.of(2026, 4, 1), LocalDate.of(2026, 6, 30), "Q2 2026"));
    }
}
