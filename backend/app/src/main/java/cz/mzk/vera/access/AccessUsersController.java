package cz.mzk.vera.access;

import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// B9. Each user act checks access.manage before its command.
@RestController
@RequestMapping("/api/access")
final class AccessUsersController {
    private final AccessGuard guard;
    private final AccessUserCommands commands;

    AccessUsersController(AccessGuard guard, AccessUserCommands commands) {
        this.guard = guard;
        this.commands = commands;
    }

    @PostMapping("/users")
    ResponseEntity<?> localAccount(HttpServletRequest request,
            @RequestBody AccessUserCommands.LocalAccount body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireManage(caller);
        if (refusal != null) {
            return refusal;
        }
        return answer(commands.localAccount(caller, body));
    }

    @PutMapping("/users/{id}/roles")
    ResponseEntity<?> userRoles(HttpServletRequest request, @PathVariable String id,
            @RequestBody HandRoles body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireManage(caller);
        if (refusal != null) {
            return refusal;
        }
        return answer(commands.userRoles(caller, id, body.roleIds()));
    }

    @PutMapping("/users/{id}/groups")
    ResponseEntity<?> userGroups(HttpServletRequest request, @PathVariable String id,
            @RequestBody UserGroups body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireManage(caller);
        if (refusal != null) {
            return refusal;
        }
        return answer(commands.userGroups(caller, id, body.groupIds()));
    }

    @PostMapping("/users/{id}/identities")
    ResponseEntity<?> identityLink(HttpServletRequest request, @PathVariable String id,
            @RequestBody IdentityLink body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireManage(caller);
        if (refusal != null) {
            return refusal;
        }
        return answer(commands.identityLink(caller, id, body.instanceId(), body.externalId()));
    }

    @DeleteMapping("/users/{id}/identities/{instanceId}/{externalId}")
    ResponseEntity<?> identityUnlink(HttpServletRequest request, @PathVariable String id,
            @PathVariable String instanceId, @PathVariable String externalId) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireManage(caller);
        if (refusal != null) {
            return refusal;
        }
        return answer(commands.identityUnlink(caller, id, instanceId, externalId));
    }

    @PutMapping("/identity-instances/{id}/default-role")
    ResponseEntity<?> identityDefaultRole(HttpServletRequest request, @PathVariable String id,
            @RequestBody IdentityDefaultRole body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireManage(caller);
        if (refusal != null) {
            return refusal;
        }
        return answer(commands.identityDefaultRole(caller, id, body.roleId()));
    }

    @PostMapping("/users/{id}/suspend")
    ResponseEntity<?> userSuspend(HttpServletRequest request, @PathVariable String id) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireManage(caller);
        if (refusal != null) {
            return refusal;
        }
        return answer(commands.userSuspend(caller, id));
    }

    @PostMapping("/users/{id}/restore")
    ResponseEntity<?> userRestore(HttpServletRequest request, @PathVariable String id) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireManage(caller);
        if (refusal != null) {
            return refusal;
        }
        return answer(commands.userRestore(caller, id));
    }

    private ResponseEntity<?> answer(AccessUserCommands.Result result) {
        if (result.status() == 204) {
            return ResponseEntity.noContent().build();
        }
        if (result.detail() != null) {
            return Problems.response(result.status(), result.detail(), result.code(), null);
        }
        return ResponseEntity.ok(result.body());
    }

    record HandRoles(List<String> roleIds) {}
    record UserGroups(List<String> groupIds) {}
    record IdentityLink(String instanceId, String externalId) {}
    record IdentityDefaultRole(String roleId) {}
}
