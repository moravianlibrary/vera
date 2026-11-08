package cz.mzk.vera.projects;

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

// VIEW-projects: check the project read grant, then return the query's read model.
@RestController
@RequestMapping("/api/projects")
final class ProjectsController {
    private final ProjectReads reads;

    ProjectsController(ProjectReads reads) {
        this.reads = reads;
    }

    @GetMapping
    ResponseEntity<?> projects(HttpServletRequest request) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        return ResponseEntity.ok(reads.projects());
    }

    @GetMapping("/overview")
    ResponseEntity<?> overview(HttpServletRequest request, @RequestParam Map<String, String> parameters) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        ResponseEntity<ProblemDetail> refusal = requireRead(caller);
        return refusal == null ? ResponseEntity.ok(reads.overview(caller.userId(), parameters)) : refusal;
    }

    @GetMapping("/{projectId}")
    ResponseEntity<?> detail(HttpServletRequest request, @PathVariable String projectId) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        ResponseEntity<ProblemDetail> refusal = requireRead(caller);
        if (refusal != null) {
            return refusal;
        }
        Map<String, Object> detail = reads.detail(caller.userId(), projectId);
        return detail == null ? Problems.response(404, "Project not found") : ResponseEntity.ok(detail);
    }

    private ResponseEntity<ProblemDetail> requireRead(Caller caller) {
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (!reads.canRead(caller.userId())) {
            return Problems.response(403, "You may not read projects");
        }
        return null;
    }
}
