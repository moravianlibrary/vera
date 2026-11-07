package cz.mzk.vera.domain.intentions;

import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.entities.DigitizationList;
import cz.mzk.vera.domain.entities.Distribution;
import cz.mzk.vera.domain.entities.Intention;
import cz.mzk.vera.domain.entities.IntentionFunding;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.entities.PropertyCondition;
import cz.mzk.vera.domain.mixes.Mixes;
import cz.mzk.vera.domain.status.Status;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.stream.Stream;

// PLAN-scope, PLAN-counting, PLAN-target, PLAN-mix-within-scope.
public final class Intentions {
  private Intentions() {}

  // isInWindow: PLAN-counting; both endpoints of the intention window count.
  public static boolean isInWindow(String countsFrom, String endsOn, String date) {
    return date != null && date.compareTo(countsFrom) >= 0
        && (endsOn == null || date.compareTo(endsOn) <= 0);
  }

  // intentionStateOf: PLAN-target; the end date is part of the running window.
  public static IntentionState intentionStateOf(String countsFrom, String endsOn, String today) {
    if (today.compareTo(countsFrom) < 0) {
      return IntentionState.Upcoming;
    }
    if (endsOn != null && today.compareTo(endsOn) > 0) {
      return IntentionState.Ended;
    }
    return IntentionState.Running;
  }

  // intentionTimeElapsedOf: PLAN-target; pace is elapsed calendar days over the inclusive window.
  public static Double intentionTimeElapsedOf(String countsFrom, String endsOn, String today) {
    if (endsOn == null) {
      return null;
    }
    long length = ChronoUnit.DAYS.between(LocalDate.parse(countsFrom), LocalDate.parse(endsOn)) + 1;
    long elapsed = ChronoUnit.DAYS.between(LocalDate.parse(countsFrom), LocalDate.parse(today));
    return Math.min(1, Math.max(0, elapsed / (double) length));
  }

  // isInIntentionScope: PLAN-scope; funding, category lineage and property conditions must match.
  public static boolean isInIntentionScope(Intention intention, Iteration iteration,
      List<Category> categories, BiPredicate<List<PropertyCondition>, Iteration> meetsConditions) {
    IntentionFunding funding = intention.funding();
    boolean fundingMatches = funding.kind().equals("any")
        || (funding.kind().equals("none") ? iteration.projectId() == null
            : Objects.equals(funding.projectId(), iteration.projectId()));
    boolean categoryMatches = intention.scopeCategoryId() == null
        || Categories.lineageOf(categories, iteration.categoryId()).contains(intention.scopeCategoryId());
    boolean conditionsMatch = intention.scopeConditions().isEmpty() || meetsConditions == null
        || meetsConditions.test(intention.scopeConditions(), iteration);
    return fundingMatches && categoryMatches && conditionsMatch;
  }

  // countIntention: PLAN-counting and PLAN-digitized-date; planned, delivered and output overlap.
  public static IntentionCount countIntention(Intention intention, CountingData data) {
    List<Iteration> matching = data.iterations().stream()
        .filter(item -> isInIntentionScope(intention, item, data.categories(), data.meetsConditions()))
        .toList();
    List<Iteration> planned = matching.stream().filter(item -> {
      DigitizationList list = data.lists().stream()
          .filter(candidate -> candidate.id().equals(item.listId())).findFirst().orElse(null);
      return list != null && isInWindow(intention.countsFrom(), intention.endsOn(), list.startsOn())
          && (item.cancellation() == null || Status.isProgressAtLeast(item.progress(), Progress.Digitized));
    }).toList();
    List<Iteration> delivered = planned.stream()
        .filter(item -> isInWindow(intention.countsFrom(), intention.endsOn(), digitizedOnOf(item))).toList();
    List<Iteration> output = matching.stream()
        .filter(item -> isInWindow(intention.countsFrom(), intention.endsOn(), digitizedOnOf(item))).toList();
    int plannedPages = pages(planned, data.pagesOf());
    int deliveredPages = pages(delivered, data.pagesOf());
    int outputPages = pages(output, data.pagesOf());
    int noDateCount = (int) matching.stream().filter(item ->
        Status.isProgressAtLeast(item.progress(), Progress.Digitized) && digitizedOnOf(item) == null).count();
    Set<String> noPages = new HashSet<>();
    Stream.concat(planned.stream(), output.stream()).filter(item -> data.pagesOf().apply(item) == null)
        .forEach(item -> noPages.add(item.id()));
    return new IntentionCount(ids(planned), ids(delivered), ids(output), plannedPages, deliveredPages,
        outputPages, noDateCount, noPages.size());
  }

  private static int pages(List<Iteration> items, Function<Iteration, Integer> pagesOf) {
    return items.stream().map(pagesOf).filter(Objects::nonNull).mapToInt(Integer::intValue).sum();
  }

  private static List<String> ids(List<Iteration> items) {
    return items.stream().map(Iteration::id).toList();
  }

  private static String digitizedOnOf(Iteration item) {
    if (!Status.isProgressAtLeast(item.progress(), Progress.Digitized) || item.digitizedAt() == null) {
      return null;
    }
    return item.digitizedAt().substring(0, 10);
  }

  // targetVerdictOf: PLAN-target; ten percentage points of pace slack apply while running.
  public static TargetVerdict targetVerdictOf(Intention intention, int plannedPages,
      int deliveredPages, String today) {
    Integer target = intention.targetPages();
    if (target == null) {
      return null;
    }
    IntentionState state = intentionStateOf(intention.countsFrom(), intention.endsOn(), today);
    boolean met = deliveredPages >= target;
    boolean fullyPlanned = plannedPages >= target;
    if (state == IntentionState.Upcoming) {
      return fullyPlanned ? TargetVerdict.FullyPlanned : null;
    }
    if (state == IntentionState.Ended) {
      return met ? TargetVerdict.TargetMet : TargetVerdict.Short;
    }
    if (met) {
      return TargetVerdict.TargetMet;
    }
    Double elapsed = intentionTimeElapsedOf(intention.countsFrom(), intention.endsOn(), today);
    if (elapsed == null) {
      return fullyPlanned ? TargetVerdict.FullyPlanned : null;
    }
    return deliveredPages / (double) target >= elapsed - 0.1
        ? TargetVerdict.OnPace : TargetVerdict.BehindPace;
  }

  // mixCategoriesOf: PLAN-mix-within-scope; the immediate children are the sibling set.
  public static List<Category> mixCategoriesOf(List<Category> categories, String scopeId) {
    return categories.stream().filter(category -> Objects.equals(category.parentId(), scopeId)).toList();
  }

  // shareWithinOf: PLAN-mix-within-scope; the scope is the 100% reference frame.
  public static Double shareWithinOf(List<Category> categories, Distribution distribution,
      String scopeId, String categoryId) {
    List<String> path = Categories.lineageOf(categories, categoryId);
    int scopeIndex = scopeId == null ? -1 : path.indexOf(scopeId);
    if (scopeId != null && scopeIndex == -1) {
      return null;
    }
    double share = 100;
    for (String id : path.subList(scopeIndex + 1, path.size())) {
      Double own = distribution.shares().get(id);
      if (own == null) {
        return null;
      }
      share = share * own / 100;
    }
    return share;
  }

  // mixNodesOf: PLAN-mix-within-scope; a leaf scope is read as itself.
  public static List<Category> mixNodesOf(List<Category> categories, String scopeId) {
    List<Category> children = mixCategoriesOf(categories, scopeId);
    if (!children.isEmpty()) {
      return children;
    }
    return categories.stream().filter(category -> category.id().equals(scopeId)).toList();
  }

  // countsTowardsOf: PLAN-counting; archived intentions and out-of-window starts are omitted.
  public static List<CountsTowards> countsTowardsOf(List<Intention> intentions, List<Iteration> members,
      String startsOn, CountingData data) {
    List<CountsTowards> result = new ArrayList<>();
    for (Intention intention : intentions) {
      if (intention.archivedAt() != null
          || !isInWindow(intention.countsFrom(), intention.endsOn(), startsOn)) {
        continue;
      }
      List<Iteration> matching = members.stream().filter(item -> isInIntentionScope(intention, item,
          data.categories(), data.meetsConditions())).toList();
      if (!matching.isEmpty()) {
        int pages = matching.stream().map(data.pagesOf()).filter(Objects::nonNull)
            .mapToInt(Integer::intValue).sum();
        result.add(new CountsTowards(intention.id(), matching.size(), pages));
      }
    }
    return result;
  }

  // listMixOf: PLAN-mix-within-scope; each row is measured in the intention's category frame.
  public static List<ListMixRow> listMixOf(List<Category> categories, Distribution distribution,
      String scopeId, List<Iteration> members, Integer targetPages, Map<String, Integer> allocation,
      Function<Iteration, Integer> pagesOf) {
    List<Iteration> inScope = members.stream().filter(item -> scopeId == null
        || Categories.lineageOf(categories, item.categoryId()).contains(scopeId)).toList();
    int total = inScope.stream().map(pagesOf).filter(Objects::nonNull).mapToInt(Integer::intValue).sum();
    List<ListMixRow> rows = new ArrayList<>();
    for (Category node : mixNodesOf(categories, scopeId)) {
      int pages = inScope.stream().filter(item -> Categories.lineageOf(categories, item.categoryId())
          .contains(node.id())).map(pagesOf).filter(Objects::nonNull).mapToInt(Integer::intValue).sum();
      Double share = shareWithinOf(categories, distribution, scopeId, node.id());
      Integer goal = allocation != null ? allocation.getOrDefault(node.id(), 0)
          : share == null ? null
              : (int) Math.floor((((targetPages == null ? total : targetPages) * share) / 100) + 0.5);
      rows.add(new ListMixRow(node.id(), share, pages, goal));
    }
    return List.copyOf(rows);
  }

  public enum IntentionState {
    Running,
    Upcoming,
    Ended
  }

  public enum TargetVerdict {
    OnPace("onPace"),
    BehindPace("behindPace"),
    TargetMet("targetMet"),
    Short("short"),
    FullyPlanned("fullyPlanned");

    private final String wireName;

    TargetVerdict(String wireName) {
      this.wireName = wireName;
    }

    public String wireName() {
      return wireName;
    }
  }

  public record CountingData(List<Category> categories, List<DigitizationList> lists,
      List<Iteration> iterations, Function<Iteration, Integer> pagesOf,
      BiPredicate<List<PropertyCondition>, Iteration> meetsConditions) {}

  public record IntentionCount(List<String> planned, List<String> delivered, List<String> output,
      int plannedPages, int deliveredPages, int outputPages, int noDateCount, int noPagesCount) {}

  public record CountsTowards(String intentionId, int itemCount, int pages) {}

  public record ListMixRow(String categoryId, Double share, int pages, Integer goalPages) {}
}
