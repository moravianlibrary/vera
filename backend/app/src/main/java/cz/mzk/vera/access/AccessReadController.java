package cz.mzk.vera.access;

import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
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

// ACCESS-read; the index requires access.read; users, groups and roles only a signed-in caller.
@RestController
final class AccessReadController {
    private final AccessQueries queries;
    private final AccessGuard guard;
    private final HeldAccessQueries heldAccess;
    private final AccessCustodyCommands custodyCommands;

    AccessReadController(AccessQueries queries, AccessGuard guard, HeldAccessQueries heldAccess,
            AccessCustodyCommands custodyCommands) {
        this.queries = queries;
        this.guard = guard;
        this.heldAccess = heldAccess;
        this.custodyCommands = custodyCommands;
    }

    @GetMapping("/api/access")
    ResponseEntity<?> access(HttpServletRequest request) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<?> refusal = requireRead(caller);
        return refusal == null ? ResponseEntity.ok(queries.index()) : refusal;
    }

    @GetMapping("/api/users")
    ResponseEntity<?> users(HttpServletRequest request) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<?> refusal = guard.requireCaller(caller);
        return refusal == null ? ResponseEntity.ok(queries.publicUsers()) : refusal;
    }

    @GetMapping("/api/groups")
    ResponseEntity<?> groups(HttpServletRequest request) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<?> refusal = guard.requireCaller(caller);
        return refusal == null ? ResponseEntity.ok(queries.referenceGroups()) : refusal;
    }

    @GetMapping("/api/roles")
    ResponseEntity<?> roles(HttpServletRequest request) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<?> refusal = guard.requireCaller(caller);
        return refusal == null ? ResponseEntity.ok(queries.roleNames()) : refusal;
    }

    private ResponseEntity<?> requireRead(Caller caller) {
        ResponseEntity<?> signedIn = guard.requireCaller(caller);
        if (signedIn != null) {
            return signedIn;
        }
        if (!Permissions.hasPermission(heldAccess.heldBy(caller.userId()).grants(), "access.read")) {
            return Problems.response(403, "You may not read users and groups");
        }
        return null;
    }

    @PostMapping("/api/access/custodies")
    ResponseEntity<?> custodyCreate(HttpServletRequest request, @RequestBody AccessCustodyCommands.Draft body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<org.springframework.http.ProblemDetail> refusal = guard.requireManage(caller);
        return refusal == null ? ActResult.answer(custodyCommands.create(caller, body)) : refusal;
    }

    @PutMapping("/api/access/custodies/{id}")
    ResponseEntity<?> custodySave(HttpServletRequest request, @PathVariable String id,
            @RequestBody AccessCustodyCommands.Draft body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<org.springframework.http.ProblemDetail> refusal = guard.requireManage(caller);
        return refusal == null ? ActResult.answer(custodyCommands.save(caller, id, body)) : refusal;
    }

    @PutMapping("/api/access/custodies/{id}/members")
    ResponseEntity<?> custodyMembers(HttpServletRequest request, @PathVariable String id,
            @RequestBody CustodyMembers body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<org.springframework.http.ProblemDetail> refusal = guard.requireManage(caller);
        return refusal == null ? ActResult.answer(
                custodyCommands.members(caller, id, body.userIds(), body.groupIds())) : refusal;
    }

    @DeleteMapping("/api/access/custodies/{id}")
    ResponseEntity<?> custodyDelete(HttpServletRequest request, @PathVariable String id) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<org.springframework.http.ProblemDetail> refusal = guard.requireManage(caller);
        return refusal == null ? ActResult.answer(custodyCommands.delete(caller, id)) : refusal;
    }

    @GetMapping("/api/access/custodies/{id}/impact")
    ResponseEntity<?> custodyImpact(HttpServletRequest request, @PathVariable String id) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<?> refusal = requireRead(caller);
        Map<String, Object> impact = queries.custodyImpact(id);
        if (refusal != null) {
            return refusal;
        }
        if (impact == null) {
            return Problems.response(404, "No such custody", "not_found", null);
        }
        return ResponseEntity.ok(impact);
    }

    record CustodyMembers(List<String> userIds, List<String> groupIds) {}
}
