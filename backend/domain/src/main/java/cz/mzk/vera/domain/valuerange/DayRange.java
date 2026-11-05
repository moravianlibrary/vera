package cz.mzk.vera.domain.valuerange;

import java.time.LocalDate;

// FILTER-range: an explicit calendar range or a relative preset.
public record DayRange(Range<LocalDate> range, ValueRange.DayPreset preset) {}
