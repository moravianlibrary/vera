package cz.mzk.vera.domain.entities;

// B3 category fields used to resolve SCOPE-custody-category.
public record Category(String id, String name, String parentId) {
  public Category(String id, String parentId) {
    this(id, id, parentId);
  }
}
