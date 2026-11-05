package cz.mzk.vera.access;

import cz.mzk.vera.session.Caller;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// ACT-role-save; ACT-role-delete: role commands require access.manage.
@RestController
@RequestMapping("/api/access/roles")
final class AccessRolesController {
    private final AccessGuard guard;
    private final AccessRoleCommands commands;

    AccessRolesController(AccessGuard guard, AccessRoleCommands commands) {
        this.guard = guard;
        this.commands = commands;
    }

    @PostMapping
    ResponseEntity<?> create(HttpServletRequest request, @RequestBody AccessRoleCommands.Draft body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireManage(caller);
        if (refusal != null) {
            return refusal;
        }
        return ActResult.answer(commands.create(caller, body));
    }

    @PutMapping("/{id}")
    ResponseEntity<?> save(HttpServletRequest request, @PathVariable String id,
            @RequestBody AccessRoleCommands.Draft body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireManage(caller);
        if (refusal != null) {
            return refusal;
        }
        return ActResult.answer(commands.save(caller, id, body));
    }

    @DeleteMapping("/{id}")
    ResponseEntity<?> delete(HttpServletRequest request, @PathVariable String id) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireManage(caller);
        if (refusal != null) {
            return refusal;
        }
        return ActResult.answer(commands.delete(caller, id));
    }

}
