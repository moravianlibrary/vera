package cz.mzk.vera.domain.iterations;

import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.PublicationLink;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.status.Status;
import java.util.List;

// V13, P1, LC-ITER-cancel, ACT-resume, ACT-overrule, STAT-gates-move-progress.
public final class Iterations {
  private Iterations() {
  }

  public static PublicationLink primaryLinkOf(Iteration iteration) {
    return iteration.links().stream().filter(PublicationLink::isPrimary).findFirst().orElse(null);
  }

  // isReclassifiable: V13; category and priority change until a scan exists.
  public static boolean isReclassifiable(Iteration iteration) {
    return !Status.isProgressAtLeast(iteration.progress(), Progress.Digitized);
  }

  // isPublishable: P1; a scan is required before it can be published.
  public static boolean isPublishable(Iteration iteration) {
    return Status.isProgressAtLeast(iteration.progress(), Progress.Digitized);
  }

  // isCancellable: LC-ITER-cancel; a hold applies only once and before the scan.
  public static boolean isCancellable(Iteration iteration) {
    return iteration.cancellation() == null
        && !Status.isProgressAtLeast(iteration.progress(), Progress.Digitized);
  }

  // isResumable: ACT-resume; a hold is lifted only before the scan.
  public static boolean isResumable(Iteration iteration) {
    return iteration.cancellation() != null
        && !Status.isProgressAtLeast(iteration.progress(), Progress.Digitized);
  }

  // isOverrulable: ACT-overrule; a standing restriction may be overruled.
  public static boolean isOverrulable(Iteration iteration) {
    return Status.isRestricted(iteration);
  }

  // progressAfterGates: V14, STAT-gates-move-progress; gate changes move Enqueued and Ready only.
  public static Progress progressAfterGates(Iteration iteration) {
    Status.Validation validation = Status.validationOf(iteration);
    boolean isClear = !Status.isRestricted(iteration)
        && (validation == Status.Validation.NotRequired || validation == Status.Validation.Approved);
    if (iteration.progress() == Progress.Enqueued && isClear && iteration.cancellation() == null) {
      return Progress.Ready;
    }
    if (iteration.progress() == Progress.Ready && !isClear) {
      return Progress.Enqueued;
    }
    return iteration.progress();
  }

  // scopeOfIteration: SCOPE-custody-category; scope follows the category's full lineage.
  public static IterationScope scopeOfIteration(List<Category> categories, String categoryId) {
    return new IterationScope("iteration", Categories.lineageOf(categories, categoryId));
  }

  public record IterationScope(String kind, List<String> categoryPathIds) {
    public IterationScope {
      categoryPathIds = List.copyOf(categoryPathIds);
    }
  }
}
