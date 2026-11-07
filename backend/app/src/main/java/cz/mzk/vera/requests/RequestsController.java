package cz.mzk.vera.requests;

import cz.mzk.vera.access.AccessGuard;
import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.documents.DocumentCodes;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// VIEW-requests: authenticate, check the list permission, then delegate the read model.
@RestController
final class RequestsController {
    private final AccessGuard guard;
    private final RequestQueries queries;
    private final HeldAccessQueries heldAccess;
    private final RequestDecisions decisions;

    RequestsController(AccessGuard guard, RequestQueries queries, HeldAccessQueries heldAccess,
            RequestDecisions decisions) {
        this.guard = guard;
        this.queries = queries;
        this.heldAccess = heldAccess;
        this.decisions = decisions;
    }

    @GetMapping("/api/requests/{documentId}")
    ResponseEntity<?> detail(HttpServletRequest request, @PathVariable String documentId) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!queries.canReadRequests(caller.userId())) {
            return Problems.response(403, "You may not read requests");
        }
        Map<String, Object> detail = queries.detail(documentId, caller.userId());
        return detail == null ? Problems.response(404, "Request not found") : ResponseEntity.ok(detail);
    }

    @GetMapping("/api/request-custodies")
    ResponseEntity<?> custodies(HttpServletRequest request) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!queries.canReadRequests(caller.userId())) {
            return Problems.response(403, "You may not read requests");
        }
        return ResponseEntity.ok(queries.custodies());
    }

    @GetMapping("/api/requests")
    ResponseEntity<?> page(HttpServletRequest request) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!queries.canReadRequests(caller.userId())) {
            return Problems.response(403, "You may not read requests");
        }
        Map<String, String> parameters = new LinkedHashMap<>();
        request.getParameterMap().forEach((key, values) -> {
            if (values.length > 0) {
                parameters.put(key, values[0]);
            }
        });
        return ResponseEntity.ok(queries.page(parameters, caller.userId()));
    }

    @PostMapping("/api/requests/{documentId}/approve")
    ResponseEntity<?> approve(HttpServletRequest request, @PathVariable String documentId,
            @RequestBody RequestDecisions.Approval approval) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!heldAccess.scopesHeldBy(caller.userId()).hasPermission(DocumentCodes.REQUEST_DECIDE)) {
            return Problems.response(403, "You may not decide proposals");
        }
        if (approval.rescanNote() != null && approval.rescanNote().isBlank()) {
            return invalidText("/rescanNote");
        }
        RequestDecisions.Approval normalized = new RequestDecisions.Approval(approval.categoryId(),
                approval.priority(), approval.rescanNote() == null ? null : approval.rescanNote().trim());
        return ActResult.answer(decisions.approve(caller, documentId, normalized));
    }

    @PostMapping("/api/requests/{documentId}/decline")
    ResponseEntity<?> decline(HttpServletRequest request, @PathVariable String documentId,
            @RequestBody RequestDecisions.Decline decline) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!heldAccess.scopesHeldBy(caller.userId()).hasPermission(DocumentCodes.REQUEST_DECIDE)) {
            return Problems.response(403, "You may not decide proposals");
        }
        if (decline.publicText().isBlank()) {
            return invalidText("/publicText");
        }
        if (decline.internalText() != null && decline.internalText().isBlank()) {
            return invalidText("/internalText");
        }
        RequestDecisions.Decline normalized = new RequestDecisions.Decline(decline.publicText().trim(),
                decline.internalText() == null ? null : decline.internalText().trim());
        return ActResult.answer(decisions.decline(caller, documentId, normalized));
    }

    @PostMapping("/api/requests/{documentId}/withdraw")
    ResponseEntity<?> withdraw(HttpServletRequest request, @PathVariable String documentId) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        return ActResult.answer(decisions.withdraw(caller, documentId));
    }

    @PostMapping("/api/requests/batches/{batchId}/approve")
    ResponseEntity<?> approveBatch(HttpServletRequest request, @PathVariable String batchId,
            @RequestBody RequestDecisions.BulkApproval bulk) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!heldAccess.scopesHeldBy(caller.userId()).hasPermission(DocumentCodes.REQUEST_DECIDE)) {
            return Problems.response(403, "You may not decide proposals");
        }
        return ActResult.answer(decisions.approveBatch(caller, batchId, bulk));
    }

    private ResponseEntity<ProblemDetail> invalidText(String pointer) {
        return Problems.response(422, "Decision text must not be blank", "invalid",
                List.of(new Problems.FieldError(pointer, "too_small")));
    }

}
