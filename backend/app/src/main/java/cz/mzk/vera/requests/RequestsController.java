package cz.mzk.vera.requests;

import cz.mzk.vera.access.AccessGuard;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// VIEW-requests: authenticate, check the list permission, then delegate the read model.
@RestController
final class RequestsController {
    private final AccessGuard guard;
    private final RequestQueries queries;

    RequestsController(AccessGuard guard, RequestQueries queries) {
        this.guard = guard;
        this.queries = queries;
    }

    @GetMapping("/api/requests/{documentId}")
    ResponseEntity<?> detail(HttpServletRequest request, @PathVariable String documentId) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!queries.canReadRequests(caller.userId())) {
            return Problems.response(403, "You may not read requests");
        }
        Map<String, Object> detail = queries.detail(documentId, caller.userId());
        return detail == null ? Problems.response(404, "Request not found") : ResponseEntity.ok(detail);
    }

    @GetMapping("/api/request-custodies")
    ResponseEntity<?> custodies(HttpServletRequest request) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!queries.canReadRequests(caller.userId())) {
            return Problems.response(403, "You may not read requests");
        }
        return ResponseEntity.ok(queries.custodies());
    }
}
