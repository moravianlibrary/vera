package cz.mzk.vera.lists;

import cz.mzk.vera.access.AccessGuard;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// VIEW-lists; LC-LIST-state; LC-LIST-pool: serve the stored list read models.
@RestController
final class ListsController {
    private final AccessGuard guard;
    private final ListsQueries queries;

    ListsController(AccessGuard guard, ListsQueries queries) {
        this.guard = guard;
        this.queries = queries;
    }

    @GetMapping("/api/lists")
    ResponseEntity<?> lists() {
        return ResponseEntity.ok(queries.lists());
    }

    @GetMapping("/api/digitization-lists")
    ResponseEntity<?> index(HttpServletRequest request, @RequestParam java.util.Map<String, String> parameters) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!queries.canRead(caller.userId())) {
            return Problems.response(403, "You may not read lists");
        }
        return ResponseEntity.ok(queries.index(new LinkedHashMap<>(parameters), caller.userId()));
    }

    @GetMapping("/api/digitization-lists/pool")
    ResponseEntity<?> pool(HttpServletRequest request, @RequestParam java.util.Map<String, String> parameters) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!queries.canBuild(caller.userId())) {
            return Problems.response(403, "You may not build lists");
        }
        return ResponseEntity.ok(queries.pool(new LinkedHashMap<>(parameters), caller.userId()));
    }

    @GetMapping("/api/digitization-lists/{listId}")
    ResponseEntity<?> detail(HttpServletRequest request, @PathVariable String listId) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!queries.canRead(caller.userId())) {
            return Problems.response(403, "You may not read lists");
        }
        var detail = queries.detail(listId, caller.userId());
        if (detail == null) {
            return Problems.response(404, "List not found");
        }
        return ResponseEntity.ok(detail);
    }
}
