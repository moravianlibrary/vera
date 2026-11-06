package cz.mzk.vera.domain.categories;

import cz.mzk.vera.domain.entities.Category;
import java.util.ArrayList;
import java.util.List;

// SCOPE-custody-category: a category scope includes its descendants.
public final class Categories {
  private Categories() {}

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
}
