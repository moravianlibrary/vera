package cz.mzk.vera.domain.events;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

// EVENT-catalogue.
class EventCodeTests {
    @Test
    void matchesContractCatalogueInOrder() throws Exception {
        String contractDir = System.getenv("VERA_CONTRACT_DIR");
        if (contractDir == null) {
            contractDir = Path.of("../contract").toAbsolutePath().toString();
        }
        Path catalogue = Path.of(contractDir, "events/catalogue.json");
        var root = JsonMapper.builder().build().readTree(Files.readString(catalogue));
        List<String> expected = new ArrayList<>();
        root.path("codes").forEach(code -> expected.add(code.path("code").asString()));
        List<String> actual = Arrays.stream(EventCode.values()).map(EventCode::code).toList();
        assertEquals(expected, actual);
    }
}
