package cz.mzk.vera.iterations;

import cz.mzk.vera.access.AccessGuard;
import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.session.Caller;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// ACT-reclassify; ACT-publish; ACT-link-replace; ACT-link-primary; ACT-link-remove: delegate each act.
@RestController
final class IterationsController {
    private final AccessGuard guard;
    private final IterationCommands commands;
    private final IterationReviewCommands reviewCommands;

    IterationsController(AccessGuard guard, IterationCommands commands,
            IterationReviewCommands reviewCommands) {
        this.guard = guard;
        this.commands = commands;
        this.reviewCommands = reviewCommands;
    }

    @PostMapping("/api/iterations/{id}/reclassify")
    ResponseEntity<?> reclassify(HttpServletRequest request, @PathVariable String id,
            @RequestBody IterationCommands.Reclassification body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return ActResult.answer(commands.reclassify(caller, id, body));
    }

    @PostMapping("/api/iterations/{id}/publish")
    ResponseEntity<?> publish(HttpServletRequest request, @PathVariable String id,
            @RequestBody IterationCommands.Publication body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return ActResult.answer(commands.publish(caller, id, body));
    }

    @PostMapping("/api/iterations/{id}/links/{linkId}/replace")
    ResponseEntity<?> replace(HttpServletRequest request, @PathVariable String id,
            @PathVariable String linkId, @RequestBody IterationCommands.Publication body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return ActResult.answer(commands.replaceLink(caller, id, linkId, body));
    }

    @PostMapping("/api/iterations/{id}/links/{linkId}/primary")
    ResponseEntity<?> primary(HttpServletRequest request, @PathVariable String id, @PathVariable String linkId,
            @RequestBody Map<String, Object> body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return ActResult.answer(commands.makePrimary(caller, id, linkId));
    }

    @DeleteMapping("/api/iterations/{id}/links/{linkId}")
    ResponseEntity<?> remove(HttpServletRequest request, @PathVariable String id, @PathVariable String linkId) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return ActResult.answer(commands.removeLink(caller, id, linkId));
    }

    @PostMapping("/api/iterations/{id}/page-count")
    ResponseEntity<?> pageCount(HttpServletRequest request, @PathVariable String id,
            @RequestBody IterationReviewCommands.PageCount body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return ActResult.answer(reviewCommands.pageCount(caller, id, body));
    }

    @PostMapping("/api/iterations/{id}/recheck")
    ResponseEntity<?> recheck(HttpServletRequest request, @PathVariable String id,
            @RequestBody Map<String, Object> body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return ActResult.answer(reviewCommands.recheck(caller, id));
    }

    @PostMapping("/api/iterations/{id}/cancel")
    ResponseEntity<?> cancel(HttpServletRequest request, @PathVariable String id,
            @RequestBody IterationReviewCommands.Cancellation body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return ActResult.answer(reviewCommands.cancel(caller, id, body));
    }

    @PostMapping("/api/iterations/{id}/resume")
    ResponseEntity<?> resume(HttpServletRequest request, @PathVariable String id,
            @RequestBody Map<String, Object> body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return ActResult.answer(reviewCommands.resume(caller, id));
    }

    @PostMapping("/api/iterations/{id}/overrule")
    ResponseEntity<?> overrule(HttpServletRequest request, @PathVariable String id,
            @RequestBody IterationReviewCommands.Overrule body) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return ActResult.answer(reviewCommands.overrule(caller, id, body));
    }
}
