package cz.mzk.vera.domain.projects;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

// LC-PROJ-period, LC-PROJ-members, SCOPE-project.
public final class Projects {
  private Projects() {}

  public enum Period {
    Upcoming,
    Active,
    Ended
  }

  public record ProjectMembers(
      String managerId, List<String> memberIds, List<String> memberGroupIds) {}

  public record ScopedRecord(
      String kind, String managerId, List<String> memberIds, List<String> memberGroupIds) {
    public ScopedRecord {
      memberIds = List.copyOf(memberIds);
      memberGroupIds = List.copyOf(memberGroupIds);
    }
  }

  // periodOf: LC-PROJ-period; the final day remains active.
  public static Period periodOf(String startsOn, String endsOn, String today) {
    if (today.compareTo(startsOn) < 0) {
      return Period.Upcoming;
    }
    return today.compareTo(endsOn) > 0 ? Period.Ended : Period.Active;
  }

  // timeElapsedOf: LC-PROJ-period; elapsed time is measured from the start of today.
  public static double timeElapsedOf(String startsOn, String endsOn, String today) {
    LocalDate start = LocalDate.parse(startsOn);
    long length = ChronoUnit.DAYS.between(start, LocalDate.parse(endsOn)) + 1;
    long elapsed = ChronoUnit.DAYS.between(start, LocalDate.parse(today));
    return Math.min(1.0, Math.max(0.0, (double) elapsed / length));
  }

  // daysUntil: LC-PROJ-period; whole calendar days, negative after the date.
  public static long daysUntil(String calendarDate, String today) {
    return ChronoUnit.DAYS.between(LocalDate.parse(today), LocalDate.parse(calendarDate));
  }

  // isProjectMember: LC-PROJ-members; manager, direct members and group members are included.
  public static boolean isProjectMember(
      ProjectMembers project, String userId, List<String> groupIds) {
    return project.managerId().equals(userId)
        || project.memberIds().contains(userId)
        || project.memberGroupIds().stream().anyMatch(groupIds::contains);
  }

  // scopeOfProject: SCOPE-project; preserve project ownership and membership in the scope record.
  public static ScopedRecord scopeOfProject(ProjectMembers project) {
    return new ScopedRecord(
        "project", project.managerId(), project.memberIds(), project.memberGroupIds());
  }
}
