package cz.mzk.vera.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;
import org.junit.jupiter.api.Test;

class NamesTests {
  @Test
  void nameInUsesRequestedLanguage() {
    assertEquals("Role", Names.nameIn(Map.of("cs", "Role česky", "en", "Role"), "en"));
  }

  @Test
  void nameInFallsBackToOtherLanguage() {
    assertEquals("Role", Names.nameIn(Map.of("en", "Role"), "cs"));
  }
}
