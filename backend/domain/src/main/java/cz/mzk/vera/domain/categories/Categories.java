package cz.mzk.vera.domain.categories;

import cz.mzk.vera.domain.entities.Category;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;

// PLAN-tree, PLAN-name, PLAN-top-level, ACCESS-category-custody, ACCESS-grant-custody.
public final class Categories {
  private Categories() {}

  // categoryPathOf: PLAN-tree; return the root-first path, or empty for an unknown category.
  public static List<Category> categoryPathOf(List<Category> categories, String categoryId) {
    Map<String, Category> byId = categories.stream().collect(Collectors.toMap(Category::id, c -> c));
    List<Category> path = new ArrayList<>();
    Category current = byId.get(categoryId);
    while (current != null && !path.contains(current)) {
      path.addFirst(current);
      current = current.parentId() == null ? null : byId.get(current.parentId());
    }
    return List.copyOf(path);
  }

  // isInSubtree: SCOPE-custody-category; a category includes itself and every descendant.
  public static boolean isInSubtree(List<Category> categories, String categoryId, String topId) {
    return lineageOf(categories, categoryId).contains(topId);
  }

  // searchedCategoriesOf: STATUS-Categories; matching names retain their ancestors.
  public static Set<String> searchedCategoriesOf(List<Category> categories, String search) {
    return searchedCategoriesOf(categories, Map.of(), search);
  }

  // UI-names: a search matches a category's name in any language, given by id.
  public static Set<String> searchedCategoriesOf(
      List<Category> categories, Map<String, Map<String, String>> namesById, String search) {
    String term = search.trim().toLowerCase(Locale.ROOT);
    if (term.isEmpty()) {
      return null;
    }
    return categories.stream().filter(c -> c.name().toLowerCase(Locale.ROOT).contains(term)
            || namesById.getOrDefault(c.id(), Map.of()).values().stream()
                .anyMatch(name -> name.toLowerCase(Locale.ROOT).contains(term)))
        .flatMap(c -> lineageOf(categories, c.id()).stream()).collect(Collectors.toSet());
  }

  // isOutsideScope: PLAN-scope; a null scope contains the whole category tree.
  public static boolean isOutsideScope(List<Category> categories, String scopeId, String categoryId) {
    return scopeId != null && (categoryId == null || !isInSubtree(categories, categoryId, scopeId));
  }

  public record CustodyHolders(List<CustodyGroup> groups, Map<String, List<String>> members) {}
  public record CustodyGroup(
      String id, String name, List<String> categoryIds, List<String> memberIds) {}
  public record CustodyReach(String userId, String groupId, String categoryId) {}
  public record CategoryScope(String kind, List<String> categoryPathIds) {}

  // custodyReachOf: ACCESS-category-custody; nearest rootward grant supplies each person's provenance.
  public static List<CustodyReach> custodyReachOf(
      List<Category> categories, CustodyHolders holders, String categoryId) {
    Map<String, CustodyReach> reach = new LinkedHashMap<>();
    for (String id : lineageOf(categories, categoryId)) {
      for (String user : holders.members().getOrDefault(id, List.of())) {
        reach.putIfAbsent(user, new CustodyReach(user, null, id));
      }
      for (CustodyGroup group : holders.groups()) {
        if (group.categoryIds().contains(id)) {
          for (String user : group.memberIds()) {
            reach.putIfAbsent(user, new CustodyReach(user, group.id(), id));
          }
        }
      }
    }
    return List.copyOf(reach.values());
  }

  // unheldCategoriesOf: ACCESS-category-custody; report the highest gaps with no held ancestor/descendant.
  public static List<Category> unheldCategoriesOf(
      List<Category> categories, CustodyHolders holders) {
    Predicate<String> held = id -> !holders.members().getOrDefault(id, List.of()).isEmpty()
        || holders.groups().stream().anyMatch(g -> g.categoryIds().contains(id));
    return categories.stream().filter(c -> !lineageOf(categories, c.id()).stream().anyMatch(held))
        .filter(c -> categories.stream()
            .noneMatch(d -> isInSubtree(categories, d.id(), c.id()) && held.test(d.id())))
        .filter(c -> c.parentId() == null || categories.stream().anyMatch(d ->
            d.id().equals(c.parentId()) && categories.stream()
                .anyMatch(x -> isInSubtree(categories, x.id(), d.id()) && held.test(x.id()))))
        .toList();
  }

  // scopeOfCategory: SCOPE-custody-category; the root is unscoped.
  public static CategoryScope scopeOfCategory(List<Category> categories, String categoryId) {
    return new CategoryScope(categoryId == null ? "unscoped" : "category",
        categoryId == null ? List.of() : lineageOf(categories, categoryId));
  }

  // placesFor: PLAN-leaf-with-documents; exclude descendants and occupied leaves.
  public static List<String> placesFor(
      List<Category> categories, String categoryId, Predicate<String> holdsDocuments) {
    List<String> result = new ArrayList<>();
    result.add(null);
    categories.stream().filter(c -> !isInSubtree(categories, c.id(), categoryId))
        .filter(c -> categories.stream().anyMatch(child -> Objects.equals(child.parentId(), c.id()))
            || !holdsDocuments.test(c.id()))
        .map(Category::id).forEach(result::add);
    return result;
  }

  // isNameTaken: PLAN-name; names are unique among siblings without regard to case.
  public static boolean isNameTaken(
      List<Category> categories, String parentId, String name, String exceptId) {
    String wanted = name.trim().toLowerCase(Locale.ROOT);
    return categories.stream().anyMatch(c -> Objects.equals(c.parentId(), parentId) && !c.id().equals(exceptId)
        && c.name().toLowerCase(Locale.ROOT).equals(wanted));
  }

  // categoryLineageOf: PLAN-tree; preserve the established name used by existing callers.
  public static List<String> lineageOf(List<Category> categories, String categoryId) {
    List<String> lineage = new ArrayList<>();
    String current = categoryId;
    while (current != null) {
      String id = current;
      Category category = categories.stream()
          .filter(candidate -> candidate.id().equals(id))
          .findFirst()
          .orElse(null);
      if (category == null) {
        return List.of();
      }
      lineage.addFirst(category.id());
      current = category.parentId();
    }
    return List.copyOf(lineage);
  }

  // leafCategoriesOf: PLAN-tree; items are classified only on categories without children.
  public static List<Category> leavesOf(List<Category> categories) {
    return categories.stream()
        .filter(category -> categories.stream().noneMatch(child -> category.id().equals(child.parentId())))
        .toList();
  }
}
