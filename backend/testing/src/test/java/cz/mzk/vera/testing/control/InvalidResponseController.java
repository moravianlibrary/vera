package cz.mzk.vera.testing.control;

import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Supplies an invalid answer for the contract response test only. */
@RestController
@ConditionalOnProperty(name = "vera.test.invalid-response", havingValue = "true")
class InvalidResponseController {
    @GetMapping("/api/batches")
    Map<String, Boolean> invalidBatchesAnswer() {
        return Map.of("not", true);
    }
}
