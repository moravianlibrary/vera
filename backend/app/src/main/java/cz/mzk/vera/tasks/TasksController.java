package cz.mzk.vera.tasks;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

// TASK-read; ACT-run-cancel; ACT-retention.
@RestController
@RequestMapping("/api/tasks")
final class TasksController {
    private final TasksQueries queries;
    private final TaskCommands commands;
    TasksController(TasksQueries queries, TaskCommands commands) {
        this.queries = queries;
        this.commands = commands;
    }

    @GetMapping
    ResponseEntity<?> index(HttpServletRequest request, @RequestParam Map<String, String> parameters) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (!queries.canRead(caller.userId())) {
            return Problems.response(403, "You may not read tasks");
        }
        return ResponseEntity.ok(queries.index(caller.userId(), parameters));
    }

    @GetMapping("/running")
    ResponseEntity<?> running(HttpServletRequest request) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (!queries.canRead(caller.userId())) {
            return Problems.response(403, "You may not read tasks");
        }
        return ResponseEntity.ok(queries.running(caller.userId()));
    }

    @GetMapping("/{runId}/log")
    ResponseEntity<?> log(HttpServletRequest request, @PathVariable String runId) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (!queries.canRead(caller.userId())) {
            return Problems.response(403, "You may not read tasks");
        }
        String value = queries.logText(caller.userId(), runId);
        return value == null ? Problems.response(404, "No such run")
                : ResponseEntity.ok().contentType(MediaType.TEXT_PLAIN).body(value);
    }

    @GetMapping("/{runId}")
    ResponseEntity<?> detail(HttpServletRequest request, @PathVariable String runId) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (!queries.canRead(caller.userId())) {
            return Problems.response(403, "You may not read tasks");
        }
        Map<String, Object> detail = queries.detail(caller.userId(), runId);
        return detail == null ? Problems.response(404, "No such run") : ResponseEntity.ok(detail);
    }

    @PostMapping("/{runId}/cancel")
    ResponseEntity<?> cancel(HttpServletRequest request, @PathVariable String runId) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.cancel(caller, runId));
    }

    @PostMapping("/{runId}/rerun")
    ResponseEntity<?> rerun(HttpServletRequest request, @PathVariable String runId) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.rerun(caller, runId));
    }

    @PutMapping("/retention")
    ResponseEntity<?> retention(HttpServletRequest request, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        Map<String, Integer> values = new LinkedHashMap<>();
        values.put("days", body.path("days").asInt());
        values.put("failedDays", body.path("failedDays").asInt());
        return ActResult.answer(commands.retention(caller, values));
    }

    private Caller caller(HttpServletRequest request) {
        return (Caller) request.getAttribute(Caller.class.getName());
    }
}
