package cz.mzk.vera.mixes;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

// PLAN-mix; ACT-mix-create; ACT-mix-save; ACT-mix-snapshot; ACT-mix-primary; ACT-mix-archive; ACT-mix-delete.
@RestController
@RequestMapping("/api/mixes")
final class MixesController {
    private final MixQueries queries;
    private final MixCommands commands;

    MixesController(MixQueries queries, MixCommands commands) {
        this.queries = queries;
        this.commands = commands;
    }

    @GetMapping
    ResponseEntity<?> list(HttpServletRequest request) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (!queries.mayRead(caller)) {
            return Problems.response(403, "You may not read mixes");
        }
        return ResponseEntity.ok(queries.list(caller));
    }

    @GetMapping("/{mixId}")
    ResponseEntity<?> get(HttpServletRequest request, @PathVariable String mixId) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (!queries.mayRead(caller)) {
            return Problems.response(403, "You may not read mixes");
        }
        Map<String, Object> record = queries.get(caller, mixId);
        return record == null ? Problems.response(404, "No such mix") : ResponseEntity.ok(record);
    }

    @PostMapping
    ResponseEntity<?> create(HttpServletRequest request, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.create(caller, body));
    }

    @PutMapping("/{mixId}/sets")
    ResponseEntity<?> save(HttpServletRequest request, @PathVariable String mixId, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.save(caller, mixId, body));
    }

    @PostMapping("/{mixId}/snapshots")
    ResponseEntity<?> snapshot(HttpServletRequest request, @PathVariable String mixId,
            @RequestBody JsonNode body) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.snapshot(caller, mixId, body));
    }

    @PostMapping("/{mixId}/primary")
    ResponseEntity<?> primary(HttpServletRequest request, @PathVariable String mixId) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.primary(caller, mixId));
    }

    @PostMapping("/{mixId}/archive")
    ResponseEntity<?> archive(HttpServletRequest request, @PathVariable String mixId) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.archive(caller, mixId));
    }

    @DeleteMapping("/{mixId}")
    ResponseEntity<?> delete(HttpServletRequest request, @PathVariable String mixId) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.delete(caller, mixId));
    }

    private Caller caller(HttpServletRequest request) {
        return (Caller) request.getAttribute(Caller.class.getName());
    }
}
