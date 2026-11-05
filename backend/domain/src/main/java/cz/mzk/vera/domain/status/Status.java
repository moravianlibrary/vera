package cz.mzk.vera.domain.status;

import cz.mzk.vera.domain.entities.CancellationCause;
import cz.mzk.vera.domain.entities.Decision;
import cz.mzk.vera.domain.entities.Defect;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.entities.Request;
import cz.mzk.vera.domain.entities.Verdict;
import cz.mzk.vera.domain.entities.VerdictKind;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

// STAT-validation, STAT-denial-lapses, STAT-gates, STAT-badge, STAT-public, STAT-checks-after-scan.
public final class Status {
  private Status() {
  }

  public enum Validation { Needed, Denied, Approved, NotRequired }

  public enum DisplayStatus {
    Declined,
    Withdrawn,
    AwaitingReview,
    BeingAdded,
    Cancelled,
    NotDigitizable,
    Forbidden,
    ValidationDenied,
    ReviewNeeded,
    Enqueued,
    IngestFailed,
    Ready,
    Planned,
    InProgress,
    Digitized,
    Published
  }

  public enum PublicStatus {
    WaitingForReview,
    NotAccepted,
    Withdrawn,
    BeingAdded,
    BeingChecked,
    WaitingToBeScheduled,
    Scheduled,
    Available,
    OnHold,
    NotAvailable
  }

  public enum StatusFootnote { ReviewNeeded, ValidationDenied }

  public static boolean isProgressAtLeast(Progress progress, Progress threshold) {
    return progress.ordinal() >= threshold.ordinal();
  }

  public static Set<String> approvedKeysOf(Iteration iteration) {
    Set<String> keys = new LinkedHashSet<>();
    for (Verdict verdict : iteration.verdicts()) {
      for (String key : verdict.defectKeys()) {
        if (verdict.verdict() == VerdictKind.Approved) {
          keys.add(key);
        } else if (verdict.verdict() == VerdictKind.Revoked) {
          keys.remove(key);
        }
      }
    }
    return keys;
  }

  public static Set<String> deniedKeysOf(Iteration iteration) {
    Set<String> keys = new LinkedHashSet<>();
    for (Verdict verdict : iteration.verdicts()) {
      if (verdict.verdict() == VerdictKind.Denied) {
        keys.addAll(verdict.defectKeys());
      }
    }
    return keys;
  }

  public static List<Defect> outstandingDefects(Iteration iteration) {
    Set<String> approved = approvedKeysOf(iteration);
    return iteration.defects().stream().filter(defect -> !approved.contains(defect.key())).toList();
  }

  public static Validation validationOf(Iteration iteration) {
    if (iteration.defects().isEmpty()) {
      return Validation.NotRequired;
    }
    Set<String> denied = deniedKeysOf(iteration);
    if (iteration.defects().stream().anyMatch(defect -> denied.contains(defect.key()))) {
      return Validation.Denied;
    }
    Set<String> approved = approvedKeysOf(iteration);
    return iteration.defects().stream().allMatch(defect -> approved.contains(defect.key()))
        ? Validation.Approved
        : Validation.Needed;
  }

  public static boolean isRestricted(Iteration iteration) {
    return iteration.restriction() != null && iteration.restrictionOverride() == null;
  }

  public static boolean passesGates(Iteration iteration) {
    Validation validation = validationOf(iteration);
    return !isRestricted(iteration)
        && (validation == Validation.NotRequired || validation == Validation.Approved)
        && iteration.cancellation() == null;
  }

  public static DisplayStatus iterationStatusOf(Iteration iteration) {
    if (iteration.cancellation() != null && iteration.cancellation().cause() == CancellationCause.Decided) {
      return DisplayStatus.Cancelled;
    }
    if (iteration.cancellation() != null
        && iteration.cancellation().cause() == CancellationCause.NotDigitizable) {
      return DisplayStatus.NotDigitizable;
    }
    if (isProgressAtLeast(iteration.progress(), Progress.Digitized)) {
      return displayStatusOf(iteration.progress());
    }
    if (isRestricted(iteration)) {
      return DisplayStatus.Forbidden;
    }
    Validation validation = validationOf(iteration);
    if (validation == Validation.Denied) {
      return DisplayStatus.ValidationDenied;
    }
    if (validation == Validation.Needed) {
      return DisplayStatus.ReviewNeeded;
    }
    return displayStatusOf(iteration.progress());
  }

  public static DisplayStatus decisionStatusOf(Decision decision) {
    return switch (decision) {
      case Pending -> DisplayStatus.AwaitingReview;
      case Approved -> DisplayStatus.BeingAdded;
      case Denied -> DisplayStatus.Declined;
      case Withdrawn -> DisplayStatus.Withdrawn;
      case Duplicate -> throw new IllegalArgumentException("Duplicate has no decision status");
    };
  }

  public static StatusFootnote statusFootnoteOf(Iteration iteration) {
    if (!isProgressAtLeast(iteration.progress(), Progress.Digitized)) {
      return null;
    }
    Validation validation = validationOf(iteration);
    if (validation == Validation.Needed) {
      return StatusFootnote.ReviewNeeded;
    }
    return validation == Validation.Denied ? StatusFootnote.ValidationDenied : null;
  }

  public static PublicStatus publicStatusOf(Request request, Iteration iteration) {
    if (request.decision() == Decision.Pending) {
      return PublicStatus.WaitingForReview;
    }
    if (request.decision() == Decision.Denied) {
      return PublicStatus.NotAccepted;
    }
    if (request.decision() == Decision.Withdrawn) {
      return PublicStatus.Withdrawn;
    }
    return iteration == null ? PublicStatus.BeingAdded : publicIterationStatusOf(iteration);
  }

  public static PublicStatus publicIterationStatusOf(Iteration iteration) {
    if (iteration.cancellation() != null) {
      return PublicStatus.OnHold;
    }
    if (iteration.progress() == Progress.IngestFailed) {
      return PublicStatus.BeingAdded;
    }
    if (isProgressAtLeast(iteration.progress(), Progress.Digitized)) {
      return PublicStatus.Available;
    }
    if (isRestricted(iteration)) {
      return PublicStatus.NotAvailable;
    }
    if (iteration.progress() == Progress.Planned || iteration.progress() == Progress.InProgress) {
      return PublicStatus.Scheduled;
    }
    return iteration.progress() == Progress.Ready && passesGates(iteration)
        ? PublicStatus.WaitingToBeScheduled
        : PublicStatus.BeingChecked;
  }

  private static DisplayStatus displayStatusOf(Progress progress) {
    return switch (progress) {
      case Enqueued -> DisplayStatus.Enqueued;
      case IngestFailed -> DisplayStatus.IngestFailed;
      case Ready -> DisplayStatus.Ready;
      case Planned -> DisplayStatus.Planned;
      case InProgress -> DisplayStatus.InProgress;
      case Digitized -> DisplayStatus.Digitized;
      case Published -> DisplayStatus.Published;
    };
  }
}
