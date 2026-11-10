package cz.mzk.vera.testing.control;

import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Supplies an invalid answer for the contract response test only. */
@RestController
@ConditionalOnProperty(name = "vera.test.invalid-response", havingValue = "true")
class InvalidResponseController {
    // The real "/api/tasks/{runId}" pattern, told apart by a header, so it never clashes with the
    // served route and the contract filter checks the answer against that operation.
    @GetMapping(value = "/api/tasks/{runId}", headers = "X-Invalid-Answer")
    Map<String, Boolean> invalidRunAnswer() {
        return Map.of("not", true);
    }
}
