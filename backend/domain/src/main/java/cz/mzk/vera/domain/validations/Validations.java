package cz.mzk.vera.domain.validations;

import cz.mzk.vera.domain.entities.Defect;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.status.Status;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.function.Function;

// STAT-validation, STAT-badge, STAT-defect-key, STAT-denial-lapses, STAT-checks-after-scan, C10.
public final class Validations {
  private Validations() {}

  public enum ReviewState { Needed, Denied, Approved, Forbidden }

  // reviewStateOf: STAT-validation, STAT-badge; cancellation leaves review to Documents,
  // restriction forbids it.
  public static ReviewState reviewStateOf(Iteration iteration) {
    if (iteration.cancellation() != null) {
      return null;
    }
    if (Status.isRestricted(iteration)) {
      return ReviewState.Forbidden;
    }
    Status.Validation validation = Status.validationOf(iteration);
    return validation == Status.Validation.NotRequired ? null : ReviewState.valueOf(validation.name());
  }

  // waitingSinceOf: STAT-validation; a restriction or oldest finding starts the wait.
  public static String waitingSinceOf(Iteration iteration) {
    if (Status.isRestricted(iteration) && iteration.restriction() != null) {
      return iteration.restriction().foundAt();
    }
    List<Defect> outstanding = Status.outstandingDefects(iteration);
    List<Defect> findings = outstanding.isEmpty() ? iteration.defects() : outstanding;
    return findings.stream().map(Defect::firstSeenAt).min(Comparator.naturalOrder()).orElse("");
  }

  // defectsToRuleOn: STAT-validation; accepted defects leave the Needed review queue.
  public static List<Defect> defectsToRuleOn(Iteration iteration) {
    return Status.validationOf(iteration) == Status.Validation.Needed
        ? Status.outstandingDefects(iteration)
        : iteration.defects();
  }

  // acceptedDefectsOf: STAT-validation; accepted findings still present are accepted defects.
  public static List<Defect> acceptedDefectsOf(Iteration iteration) {
    Set<String> keys = Status.approvedKeysOf(iteration);
    return iteration.defects().stream().filter(defect -> keys.contains(defect.key())).toList();
  }

  // deniedDefectsOf: STAT-denial-lapses; denied findings count only while still present.
  public static List<Defect> deniedDefectsOf(Iteration iteration) {
    Set<String> keys = Status.deniedKeysOf(iteration);
    return iteration.defects().stream().filter(defect -> keys.contains(defect.key())).toList();
  }

  // isFoundAfterScan: C10, STAT-checks-after-scan; findings can arrive after digitization.
  public static boolean isFoundAfterScan(Iteration iteration) {
    return Status.isProgressAtLeast(iteration.progress(), Progress.Digitized);
  }

  // pagesSubject: DOC-manual-page-count; page count is the subject rerun by VERA.
  public static final String PAGES_SUBJECT = "pages";

  // defectNameOf: STAT-defect-key; display the instance name and rule code, never its id.
  public static String defectNameOf(Defect defect, Function<String, String> instanceNameOf) {
    return instanceNameOf.apply(defect.instanceId()) + " " + defect.ruleCode();
  }
}
