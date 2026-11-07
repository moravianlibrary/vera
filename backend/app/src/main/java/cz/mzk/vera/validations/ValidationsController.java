package cz.mzk.vera.validations;

import cz.mzk.vera.access.AccessGuard;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// VIEW-validations: serve the review queue and one reachable validation detail.
@RestController
final class ValidationsController {
    private final AccessGuard guard;
    private final ValidationQueries queries;

    ValidationsController(AccessGuard guard, ValidationQueries queries) {
        this.guard = guard;
        this.queries = queries;
    }

    @GetMapping("/api/validations")
    ResponseEntity<?> page(HttpServletRequest request, @RequestParam Map<String, String> parameters) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!queries.canReview(caller.userId())) {
            return Problems.response(403, ValidationCodes.MAY_NOT_REVIEW);
        }
        return ResponseEntity.ok(queries.page(new LinkedHashMap<>(parameters), caller.userId()));
    }

    @GetMapping("/api/validations/{iterationId}")
    ResponseEntity<?> detail(HttpServletRequest request, @PathVariable String iterationId) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!queries.canReview(caller.userId())) {
            return Problems.response(403, ValidationCodes.MAY_NOT_REVIEW);
        }
        Map<String, Object> detail = queries.detail(iterationId, caller.userId());
        return detail == null
                ? Problems.response(404, ValidationCodes.NOTHING_WAITS, ValidationCodes.NOT_WAITING, null)
                : ResponseEntity.ok(detail);
    }
}
