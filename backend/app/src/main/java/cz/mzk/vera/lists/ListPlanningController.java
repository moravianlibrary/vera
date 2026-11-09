package cz.mzk.vera.lists;

import cz.mzk.vera.access.AccessGuard;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

// PLAN-generate-*; PLAN-mix-reading; ACT-refusal: thin routes for list planning.
@RestController
class ListPlanningController {
    private final AccessGuard guard;
    private final ListPlanningQueries queries;

    ListPlanningController(AccessGuard guard, ListPlanningQueries queries) {
        this.guard = guard;
        this.queries = queries;
    }

    @GetMapping("/api/digitization-lists/generators")
    ResponseEntity<?> generators(HttpServletRequest request) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return queries.generators(caller.userId());
    }

    @GetMapping("/api/digitization-lists/shapes")
    ResponseEntity<?> shapes(HttpServletRequest request) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return queries.shapes(caller.userId());
    }

    @PostMapping("/api/digitization-lists/reading")
    ResponseEntity<?> reading(HttpServletRequest request, @RequestBody JsonNode body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return queries.reading(caller.userId(), body);
    }

    @PostMapping("/api/digitization-lists/generate")
    ResponseEntity<?> generate(HttpServletRequest request, @RequestBody JsonNode body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return queries.generate(caller.userId(), body);
    }
}
