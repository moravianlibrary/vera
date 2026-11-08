package cz.mzk.vera.domain.entities;

// LC-LIST and PLAN-counting: the stored list fields used by list rules and intention counts.
public record DigitizationList(String id, String name, String startsOn, String endsOn,
    Integer targetPages, String doneAt) {
}
