package cz.mzk.vera.domain.mixes;

import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.entities.Category;
import java.util.List;
import java.util.Map;
import java.util.Objects;

// PLAN-mix-sets: sibling sets stay unscaled; PLAN-mix-within-scope: shares multiply down the tree.
public final class Mixes {
  private Mixes() {}

  // effectiveShareOf: PLAN-mix-sets; each share multiplies its ancestors' shares.
  public static Double effectiveShareOf(List<Category> categories, Map<String, Double> shares,
      String categoryId) {
    List<Category> path = Categories.lineageOf(categories, categoryId).stream()
        .map(id -> categories.stream().filter(category -> category.id().equals(id)).findFirst().orElseThrow())
        .toList();
    if (path.isEmpty()) {
      return null;
    }
    double share = 1;
    for (Category category : path) {
      Double own = shares.get(category.id());
      if (own == null) {
        return null;
      }
      share *= own / 100;
    }
    return share * 100;
  }

  // siblingSetOf: PLAN-mix-sets; a missing share remains unallocated.
  public static SiblingSet siblingSetOf(List<Category> categories, Map<String, Double> shares,
      String parentId) {
    List<Category> children = categories.stream()
        .filter(category -> Objects.equals(category.parentId(), parentId)).toList();
    if (children.isEmpty()) {
      return new SiblingSet(0, List.of());
    }
    double allocated = children.stream().mapToDouble(child -> shares.getOrDefault(child.id(), 0.0)).sum();
    List<String> noShareIds = children.stream().filter(child -> !shares.containsKey(child.id()))
        .map(Category::id).toList();
    return new SiblingSet(Math.max(0, 100 - allocated), noShareIds);
  }

  public record SiblingSet(double unallocated, List<String> noShareIds) {}
}
