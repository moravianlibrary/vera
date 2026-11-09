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
import java.time.DayOfWeek;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.stream.Stream;
import cz.mzk.vera.domain.projects.Projects;

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

  // pagesPerWeekNeededOf: PLAN-target; round the even remaining pace up to tens.
  public static Integer pagesPerWeekNeededOf(Intention intention, int deliveredPages, String today) {
    if (intention.targetPages() == null || intention.endsOn() == null
        || intentionStateOf(intention.countsFrom(), intention.endsOn(), today) != IntentionState.Running
        || deliveredPages >= intention.targetPages()) {
      return null;
    }
    long days = ChronoUnit.DAYS.between(LocalDate.parse(today), LocalDate.parse(intention.endsOn())) + 1;
    double weeks = Math.max(1, days) / 7.0;
    return (int) (Math.ceil((intention.targetPages() - deliveredPages) / weeks / 10.0) * 10);
  }

  // catchUpPagesOf: PLAN-catch-up; report the planned-page gap from an even pace in tens.
  public static Integer catchUpPagesOf(
      Intention intention, int plannedPages, int deliveredPages, String today) {
    if (intention.targetPages() == null || intention.endsOn() == null
        || targetVerdictOf(intention, plannedPages, deliveredPages, today) != TargetVerdict.BehindPace) {
      return null;
    }
    double elapsed = intentionTimeElapsedOf(intention.countsFrom(), intention.endsOn(), today);
    return Math.max(0, (int) Math.round((intention.targetPages() * elapsed - plannedPages) / 10.0) * 10);
  }

  // nextPeriodStartOf: LC-INT-repeat; occurrences begin at the next period boundary.
  public static LocalDate nextPeriodStartOf(RepeatPeriod period, LocalDate today) {
    if (period == RepeatPeriod.week) {
      return today.with(TemporalAdjusters.next(DayOfWeek.MONDAY));
    }
    int months = period == RepeatPeriod.month ? 1 : 3;
    int start = ((today.getMonthValue() - 1) / months) * months + 1;
    return LocalDate.of(today.getYear(), start, 1).plusMonths(months);
  }

  // scopeOfIntention: permissions.md §3; only project-funded intentions have project scope.
  public static Object scopeOfIntention(IntentionFunding funding, List<ProjectScope> projects) {
    if (!funding.kind().equals("project")) {
      return Map.of("kind", "unscoped");
    }
    return projects.stream().filter(p -> p.id().equals(funding.projectId())).findFirst()
        .<Object>map(p -> new Projects.ScopedRecord("project", p.managerId(), p.memberIds(), p.memberGroupIds()))
        .orElseGet(() -> Map.of("kind", "unscoped"));
  }

  public record ProjectScope(
      String id, String managerId, List<String> memberIds, List<String> memberGroupIds) {}
  public enum RepeatPeriod { week, month, quarter }

  // mixReadingOf: PLAN-mix-reading and PLAN-mix-flags; the five point band is display tolerance.
  public static MixReading mixReadingOf(
      List<Category> categories, Distribution distribution, String scopeId,
      List<Iteration> planned, List<Iteration> output, int plannedPages, int outputPages,
      Function<Iteration, Integer> pagesOf) {
    List<MixRow> rows = new ArrayList<>();
    List<Category> nodes = mixCategoriesOf(categories, scopeId);
    for (Category node : nodes) {
      int op = pagesUnder(categories, node.id(), output, pagesOf);
      int pp = pagesUnder(categories, node.id(), planned, pagesOf);
      Double intended = shareWithinOf(categories, distribution, scopeId, node.id());
      Double actual = outputPages == 0 ? null : op * 100.0 / outputPages;
      Double drift = actual == null || intended == null ? null : actual - intended;
      String flag = intended != null && intended == 0 && op > 0 ? "excludedUsed"
          : intended == null ? "noShare" : drift == null ? null
              : Math.abs(drift) <= 5 ? "inBand" : drift > 0 ? "over" : "under";
      rows.add(new MixRow(node.id(), intended, plannedPages == 0 ? null : pp * 100.0 / plannedPages,
          actual, op, drift, flag));
    }
    double allocated = nodes.stream().mapToDouble(n -> distribution.shares().getOrDefault(n.id(), 0.0)).sum();
    int out = (int) rows.stream().filter(r -> "over".equals(r.flag()) || "under".equals(r.flag())
        || "excludedUsed".equals(r.flag())).count();
    return new MixReading(List.copyOf(rows), nodes.isEmpty() ? 0 : Math.max(0, 100 - allocated), out);
  }

  private static int pagesUnder(List<Category> categories, String id, List<Iteration> items,
      Function<Iteration, Integer> pagesOf) {
    return items.stream().filter(i -> Categories.lineageOf(categories, i.categoryId()).contains(id))
        .map(pagesOf).filter(Objects::nonNull).mapToInt(Integer::intValue).sum();
  }

  // fillOf: PLAN-fill; compare each scoped leaf's planned pages with 95% of its target share.
  public static List<FillRow> fillOf(
      List<Category> categories, Distribution distribution, String scopeId, Integer targetPages,
      List<Iteration> planned, List<Iteration> delivered, Function<Iteration, Integer> pagesOf) {
    List<FillRow> rows = new ArrayList<>();
    for (Category leaf : Categories.leavesOf(categories)) {
      if (scopeId != null && !Categories.lineageOf(categories, leaf.id()).contains(scopeId)) {
        continue;
      }
      Double share = shareWithinOf(categories, distribution, scopeId, leaf.id());
      Integer target = share == null || share == 0 || targetPages == null ? null
          : (int) Math.floor(targetPages * share / 100.0 + 0.5);
      int pp = planned.stream().filter(i -> i.categoryId().equals(leaf.id())).map(pagesOf)
          .filter(Objects::nonNull).mapToInt(Integer::intValue).sum();
      int dp = delivered.stream().filter(i -> i.categoryId().equals(leaf.id())).map(pagesOf)
          .filter(Objects::nonNull).mapToInt(Integer::intValue).sum();
      rows.add(new FillRow(leaf.id(), share, target, pp, dp, target != null && pp < target * 0.95));
    }
    return List.copyOf(rows);
  }

  public record FillRow(
      String categoryId, Double share, Integer targetPages, int plannedPages,
      int deliveredPages, boolean isShort) {}
  public record MixRow(
      String categoryId, Double intended, Double planned, Double output, int outputPages,
      Double drift, String flag) {}
  public record MixReading(List<MixRow> rows, double unallocated, int outOfBandCount) {}

  // correctionOf: PLAN-generate-correcting; cut excess gaps proportionally, then round to tens.
  public static Correction correctionOf(
      List<CorrectionInputRow> rows, int outputPages, int pages, Map<String, Integer> ready) {
    double whole = outputPages + pages;
    List<Double> needs = rows.stream().map(r -> r.intended() == null ? 0.0
        : Math.max(0, r.intended() / 100.0 * whole - r.outputPages())).toList();
    double needed = needs.stream().mapToDouble(Double::doubleValue).sum();
    double intendedSum = rows.stream().mapToDouble(r -> r.intended() == null ? 0 : r.intended()).sum();
    List<CorrectionRow> result = new ArrayList<>();
    for (int i = 0; i < rows.size(); i++) {
      CorrectionInputRow row = rows.get(i);
      double need = needs.get(i);
      double raw = needed >= pages ? needed == 0 ? 0 : pages * need / needed
          : need + (intendedSum == 0 ? 0
              : (pages - needed) * (row.intended() == null ? 0 : row.intended()) / intendedSum);
      int allocated = (int) Math.floor(raw / 10 + 0.5) * 10;
      int readyPages = ready.getOrDefault(row.categoryId(), 0);
      result.add(new CorrectionRow(row.categoryId(), allocated,
          whole == 0 ? 0 : (row.outputPages() + allocated) / whole * 100.0,
          readyPages, Math.max(0, allocated - readyPages)));
    }
    return new Correction(List.copyOf(result), needed > pages);
  }
  public record CorrectionInputRow(String categoryId, Double intended, int outputPages) {}
  public record CorrectionRow(
      String categoryId, int newPages, double after, int readyPages, int shortPages) {}
  public record Correction(List<CorrectionRow> rows, boolean isCut) {}

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
