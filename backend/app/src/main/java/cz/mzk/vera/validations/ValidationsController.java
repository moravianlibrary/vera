package cz.mzk.vera.validations;

import cz.mzk.vera.access.AccessGuard;
import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// VIEW-validations; ACT-accept; ACT-deny; ACT-revoke: serve the review queue and verdict acts.
@RestController
final class ValidationsController {
    private final AccessGuard guard;
    private final ValidationQueries queries;
    private final ValidationCommands commands;
    private final HeldAccessQueries access;

    ValidationsController(AccessGuard guard, ValidationQueries queries, ValidationCommands commands,
            HeldAccessQueries access) {
        this.guard = guard;
        this.queries = queries;
        this.commands = commands;
        this.access = access;
    }

    @GetMapping("/api/validations")
    ResponseEntity<?> page(HttpServletRequest request, @RequestParam Map<String, String> parameters) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!queries.canReview(caller.userId())) {
            return Problems.response(403, ValidationCodes.MAY_NOT_REVIEW);
        }
        return ResponseEntity.ok(queries.page(new LinkedHashMap<>(parameters), caller.userId()));
    }

    @GetMapping("/api/validations/{iterationId}")
    ResponseEntity<?> detail(HttpServletRequest request, @PathVariable String iterationId) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!queries.canReview(caller.userId())) {
            return Problems.response(403, ValidationCodes.MAY_NOT_REVIEW);
        }
        Map<String, Object> detail = queries.detail(iterationId, caller.userId());
        return detail == null
                ? Problems.response(404, ValidationCodes.NOTHING_WAITS, ValidationCodes.NOT_WAITING, null)
                : ResponseEntity.ok(detail);
    }

    @PostMapping("/api/validations/{id}/accept")
    ResponseEntity<?> accept(HttpServletRequest request, @PathVariable("id") String iterationId,
            @RequestBody ValidationCommands.Acceptance body) {
        ValidationCommands.Acceptance normalized = new ValidationCommands.Acceptance(body.defectKeys(),
                body.note() == null ? null : body.note().trim());
        return act(request, result -> commands.accept(result, iterationId, normalized));
    }

    @PostMapping("/api/validations/{id}/deny")
    ResponseEntity<?> deny(HttpServletRequest request, @PathVariable("id") String iterationId,
            @RequestBody ValidationCommands.Denial body) {
        ValidationCommands.Denial normalized = new ValidationCommands.Denial(body.defectKeys(),
                body.publicText().trim(), body.internalText() == null ? null : body.internalText().trim());
        return act(request, result -> commands.deny(result, iterationId, normalized));
    }

    @PostMapping("/api/validations/{id}/revoke")
    ResponseEntity<?> revoke(HttpServletRequest request, @PathVariable("id") String iterationId,
            @RequestBody ValidationCommands.Revocation body) {
        return act(request, result -> commands.revoke(result, iterationId, body));
    }

    private ResponseEntity<?> act(HttpServletRequest request,
            Function<Caller, ActResult> action) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        boolean canReview = List.of(ValidationCodes.APPROVE, ValidationCodes.DENY, ValidationCodes.REVOKE)
                .stream().anyMatch(access.scopesHeldBy(caller.userId())::hasPermission);
        if (!canReview) {
            return Problems.response(403, ValidationCodes.MAY_NOT_REVIEW);
        }
        return ActResult.answer(action.apply(caller));
    }
}
