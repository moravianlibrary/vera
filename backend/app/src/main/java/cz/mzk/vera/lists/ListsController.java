package cz.mzk.vera.lists;

import cz.mzk.vera.access.AccessGuard;
import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// VIEW-lists; LC-LIST-state; LC-LIST-pool: serve the stored list read models.
@RestController
final class ListsController {
    private final AccessGuard guard;
    private final ListsQueries queries;
    private final ListCommands commands;

    ListsController(AccessGuard guard, ListsQueries queries, ListCommands commands) {
        this.guard = guard;
        this.queries = queries;
        this.commands = commands;
    }

    @GetMapping("/api/lists")
    ResponseEntity<?> lists() {
        return ResponseEntity.ok(queries.lists());
    }

    @GetMapping("/api/digitization-lists")
    ResponseEntity<?> index(HttpServletRequest request, @RequestParam Map<String, String> parameters) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!queries.canRead(caller.userId())) {
            return Problems.response(403, "You may not read digitization lists");
        }
        return ResponseEntity.ok(queries.index(new LinkedHashMap<>(parameters), caller.userId()));
    }

    @GetMapping("/api/digitization-lists/pool")
    ResponseEntity<?> pool(HttpServletRequest request, @RequestParam Map<String, String> parameters) {
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
            return Problems.response(403, "You may not read digitization lists");
        }
        var detail = queries.detail(listId, caller.userId());
        if (detail == null) {
            return Problems.response(404, "List not found");
        }
        return ResponseEntity.ok(detail);
    }
    @PostMapping("/api/digitization-lists")
    ResponseEntity<?> create(HttpServletRequest request, @RequestBody ListCommands.Draft body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) return refusal;
        ActResult result = commands.create(caller, body);
        return result.detail() == null
                ? ResponseEntity.status(201).body(result.body())
                : ActResult.answer(result);
    }

    @PutMapping("/api/digitization-lists/{listId}")
    ResponseEntity<?> save(HttpServletRequest request, @PathVariable String listId,
            @RequestBody ListCommands.Draft body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) return refusal;
        return ActResult.answer(commands.save(caller, listId, body));
    }

    @PostMapping("/api/digitization-lists/{listId}/start")
    ResponseEntity<?> start(HttpServletRequest request, @PathVariable String listId,
            @RequestBody Map<String, Object> body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) return refusal;
        return ActResult.answer(commands.startNow(caller, listId));
    }

    @GetMapping("/api/digitization-lists/{listId}/done")
    ResponseEntity<?> previewDone(HttpServletRequest request, @PathVariable String listId) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) return refusal;
        return ActResult.answer(commands.previewDone(caller, listId));
    }

    @PostMapping("/api/digitization-lists/{listId}/done")
    ResponseEntity<?> done(HttpServletRequest request, @PathVariable String listId,
            @RequestBody Map<String, Object> body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) return refusal;
        return ActResult.answer(commands.done(caller, listId));
    }

    @GetMapping("/api/digitization-lists/{listId}/deletion")
    ResponseEntity<?> previewDelete(HttpServletRequest request, @PathVariable String listId) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) return refusal;
        return ActResult.answer(commands.previewDelete(caller, listId));
    }

    @DeleteMapping("/api/digitization-lists/{listId}")
    ResponseEntity<?> delete(HttpServletRequest request, @PathVariable String listId) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) return refusal;
        return ActResult.answer(commands.delete(caller, listId));
    }

    @PostMapping("/api/digitization-lists/{listId}/items/{iterationId}/not-digitizable")
    ResponseEntity<?> notDigitizable(HttpServletRequest request, @PathVariable String listId,
            @PathVariable String iterationId, @RequestBody ListCommands.NotDigitizable body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) return refusal;
        return ActResult.answer(commands.notDigitizable(caller, listId, iterationId, body.message()));
    }

}
