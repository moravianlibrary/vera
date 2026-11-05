package cz.mzk.vera.account;

import cz.mzk.vera.access.AccessGuard;
import cz.mzk.vera.access.AccessQueries;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.node.ObjectNode;

// B9. A person's account and settings follow their signed-in identity.
@RestController
@RequestMapping("/api/session")
final class AccountController {
    private final AccessGuard guard;
    private final AccessQueries accessQueries;
    private final AccountQueries queries;
    private final AccountCommands commands;

    AccountController(AccessGuard guard, AccessQueries accessQueries, AccountQueries queries,
            AccountCommands commands) {
        this.guard = guard;
        this.accessQueries = accessQueries;
        this.queries = queries;
        this.commands = commands;
    }

    @GetMapping("/account")
    ResponseEntity<?> account(HttpServletRequest request) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        Map<String, Object> user = accessQueries.user(caller.userId());
        if (user == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        return ResponseEntity.ok(user);
    }

    @GetMapping("/settings")
    ResponseEntity<?> settings(HttpServletRequest request) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return ResponseEntity.ok(queries.settings(caller.userId()));
    }

    @PatchMapping("/settings")
    ResponseEntity<?> patchSettings(HttpServletRequest request, @RequestBody ObjectNode change) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return ResponseEntity.ok(commands.patch(caller.userId(), change));
    }
}
