package cz.mzk.vera.domain.lists;

import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.DigitizationList;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.status.Status;

// LC-LIST-state, LC-LIST-overdue, LC-LIST-pool, LC-LIST-blocked.
public final class Lists {
  private Lists() {}

  public enum ListState {
    Planned,
    InProgress,
    Done
  }

  public enum MemberBlocker {
    Forbidden,
    ReviewNeeded,
    ValidationDenied
  }

  // listStateOf: LC-LIST-state; Done is recorded, other states follow dates.
  public static ListState listStateOf(DigitizationList list, String today) {
    if (list.doneAt() != null) {
      return ListState.Done;
    }
    return list.startsOn().compareTo(today) > 0 ? ListState.Planned : ListState.InProgress;
  }

  // isOverdue: LC-LIST-overdue; an unfinished list is overdue after its end date.
  public static boolean isOverdue(DigitizationList list, String today) {
    return list.doneAt() == null && list.endsOn().compareTo(today) < 0;
  }

  // progressOnList: LC-LIST-state; listed work is planned before the start and active thereafter.
  public static Progress progressOnList(DigitizationList list, String today) {
    return listStateOf(list, today) == ListState.Planned ? Progress.Planned : Progress.InProgress;
  }

  // isScanned: LC-LIST-blocked; digitized or published work has been scanned.
  public static boolean isScanned(Iteration iteration) {
    return Status.isProgressAtLeast(iteration.progress(), Progress.Digitized);
  }

  // memberBlockerOf: LC-LIST-blocked; status blockers remain with listed work.
  public static MemberBlocker memberBlockerOf(Iteration iteration) {
    Status.DisplayStatus status = Status.iterationStatusOf(iteration);
    return switch (status) {
      case Forbidden -> MemberBlocker.Forbidden;
      case ReviewNeeded -> MemberBlocker.ReviewNeeded;
      case ValidationDenied -> MemberBlocker.ValidationDenied;
      default -> null;
    };
  }

  // isInPool: LC-LIST-pool; only ready, unlisted work with clear gates enters the pool.
  public static boolean isInPool(Iteration iteration) {
    return iteration.progress() == Progress.Ready && iteration.listId() == null
        && Status.passesGates(iteration);
  }
}
