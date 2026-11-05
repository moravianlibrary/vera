package cz.mzk.vera.access;

import cz.mzk.vera.session.Caller;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// ACT-group-save: group commands require access.manage.
@RestController
@RequestMapping("/api/access/groups")
final class AccessGroupsController {
    private final AccessGuard guard;
    private final AccessGroupCommands commands;

    AccessGroupsController(AccessGuard guard, AccessGroupCommands commands) {
        this.guard = guard;
        this.commands = commands;
    }

    @PostMapping
    ResponseEntity<?> create(HttpServletRequest request, @RequestBody AccessGroupCommands.Draft body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireManage(caller);
        if (refusal != null) {
            return refusal;
        }
        return ActResult.answer(commands.create(caller, body));
    }

    @PutMapping("/{id}")
    ResponseEntity<?> save(HttpServletRequest request, @PathVariable String id,
            @RequestBody AccessGroupCommands.Draft body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireManage(caller);
        if (refusal != null) {
            return refusal;
        }
        return ActResult.answer(commands.save(caller, id, body));
    }

    @PutMapping("/{id}/members")
    ResponseEntity<?> members(HttpServletRequest request, @PathVariable String id, @RequestBody Members body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireManage(caller);
        if (refusal != null) {
            return refusal;
        }
        return ActResult.answer(commands.members(caller, id, body.userIds()));
    }

    record Members(List<String> userIds) {}
}
