package cz.mzk.vera.proposals;

import cz.mzk.vera.access.AccessGuard;
import cz.mzk.vera.documents.BatchQueries;
import cz.mzk.vera.session.Caller;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// ENT-batch: any signed-in caller may read served batches.
@RestController
@RequestMapping("/api/batches")
final class BatchesController {
    private final AccessGuard guard;
    private final BatchQueries queries;

    BatchesController(AccessGuard guard, BatchQueries queries) {
        this.guard = guard;
        this.queries = queries;
    }

    @GetMapping
    ResponseEntity<?> served(HttpServletRequest request) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return ResponseEntity.ok(queries.served());
    }
}
