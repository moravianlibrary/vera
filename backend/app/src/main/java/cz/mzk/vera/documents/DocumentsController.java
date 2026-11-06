package cz.mzk.vera.documents;

import cz.mzk.vera.access.AccessGuard;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
// VIEW-documents-audience: check caller and perspective, then delegate detail reading.
@RestController
@RequestMapping("/api/documents")
final class DocumentsController {
    private final AccessGuard guard;
    private final DocumentQueries queries;

    DocumentsController(AccessGuard guard, DocumentQueries queries) {
        this.guard = guard;
        this.queries = queries;
    }

    @GetMapping("/{documentId}")
    ResponseEntity<?> detail(HttpServletRequest request, @PathVariable String documentId,
            @RequestParam(required = false) String perspective) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<ProblemDetail> refusal = guard.requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        boolean mine = "my".equals(perspective);
        if (mine && !queries.canOpenMyDocuments(caller.userId())) {
            return Problems.response(403, "You may not open My Documents");
        }
        Map<String, Object> detail = queries.detail(documentId, caller.userId(), mine);
        return detail == null ? Problems.response(404, "Document not found") : ResponseEntity.ok(detail);
    }
}
