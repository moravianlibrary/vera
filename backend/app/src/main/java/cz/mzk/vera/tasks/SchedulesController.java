package cz.mzk.vera.tasks;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

// ENT-schedule; ACT-schedule-save; ACT-schedule-pause; ACT-schedule-run.
@RestController
@RequestMapping("/api/schedules")
final class SchedulesController {
    private final ScheduleReads reads;
    private final ScheduleCommands commands;

    SchedulesController(ScheduleReads reads, ScheduleCommands commands) {
        this.reads = reads;
        this.commands = commands;
    }

    @GetMapping
    ResponseEntity<?> index(HttpServletRequest request, @RequestParam Map<String, String> query) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (!reads.canRead(caller.userId())) {
            return Problems.response(403, "You may not read schedules");
        }
        return ResponseEntity.ok(reads.index(query.getOrDefault("range", "day")));
    }

    @PostMapping
    ResponseEntity<?> create(HttpServletRequest request, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.create(caller, body));
    }

    @PutMapping("/{scheduleId}")
    ResponseEntity<?> save(HttpServletRequest request, @PathVariable String scheduleId,
            @RequestBody JsonNode body) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.save(caller, scheduleId, body));
    }

    @DeleteMapping("/{scheduleId}")
    ResponseEntity<?> delete(HttpServletRequest request, @PathVariable String scheduleId) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.delete(caller, scheduleId));
    }

    @PostMapping("/{id}/pause")
    ResponseEntity<?> pause(HttpServletRequest request, @PathVariable String id, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.pause(caller, id, body.path("reason").asString()));
    }

    @PostMapping("/{scheduleId}/resume")
    ResponseEntity<?> resume(HttpServletRequest request, @PathVariable String scheduleId) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.resume(caller, scheduleId));
    }

    @PostMapping("/{scheduleId}/run")
    ResponseEntity<?> run(HttpServletRequest request, @PathVariable String scheduleId) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.run(caller, scheduleId));
    }

    private Caller caller(HttpServletRequest request) {
        return (Caller) request.getAttribute(Caller.class.getName());
    }
}
