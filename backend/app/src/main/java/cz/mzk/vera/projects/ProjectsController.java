package cz.mzk.vera.projects;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.List;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// VIEW-projects: check the project read grant, then return the query's read model.
@RestController
@RequestMapping("/api/projects")
final class ProjectsController {
    private final ProjectReads reads;
    private final ProjectCommands commands;

    ProjectsController(ProjectReads reads, ProjectCommands commands) {
        this.reads = reads;
        this.commands = commands;
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

    @PostMapping
    ResponseEntity<?> create(HttpServletRequest request, @RequestBody ProjectCommands.Draft draft) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        ResponseEntity<?> invalid = invalidDraft(draft);
        return invalid == null ? ActResult.answer(commands.create(caller, draft)) : invalid;
    }

    @PostMapping("/{projectId}/preview")
    ResponseEntity<?> preview(HttpServletRequest request, @PathVariable String projectId,
            @RequestBody ProjectCommands.Draft draft) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        ResponseEntity<?> invalid = invalidDraft(draft);
        return invalid == null ? ActResult.answer(commands.preview(caller, projectId, draft)) : invalid;
    }

    @PutMapping("/{projectId}")
    ResponseEntity<?> save(HttpServletRequest request, @PathVariable String projectId,
            @RequestBody ProjectCommands.Draft draft) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        ResponseEntity<?> invalid = invalidDraft(draft);
        return invalid == null ? ActResult.answer(commands.save(caller, projectId, draft)) : invalid;
    }

    @PutMapping("/{projectId}/members")
    ResponseEntity<?> members(HttpServletRequest request, @PathVariable String projectId,
            @RequestBody ProjectCommands.Members members) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (!members.memberIds().contains(members.managerId())) {
            return invalid("/managerId", "The manager is always a member", "custom");
        }
        return ActResult.answer(commands.members(caller, projectId, members));
    }

    @GetMapping("/{projectId}/decision")
    ResponseEntity<?> decision(HttpServletRequest request, @PathVariable String projectId) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        return ActResult.answer(commands.decision(caller, projectId));
    }

    @PostMapping("/{projectId}/approve")
    ResponseEntity<?> approve(HttpServletRequest request, @PathVariable String projectId,
            @RequestBody ProjectCommands.Approval approval) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        return ActResult.answer(commands.approve(caller, projectId, approval));
    }

    @PostMapping("/{projectId}/reject")
    ResponseEntity<?> reject(HttpServletRequest request, @PathVariable String projectId,
            @RequestBody ProjectCommands.Rejection rejection) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (rejection.reason().isBlank()) {
            return invalid("/reason", "Say why: every member reads it", "too_small");
        }
        return ActResult.answer(commands.reject(caller, projectId,
                new ProjectCommands.Rejection(rejection.reason().trim())));
    }

    @DeleteMapping("/{projectId}")
    ResponseEntity<?> delete(HttpServletRequest request, @PathVariable String projectId) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        return ActResult.answer(commands.delete(caller, projectId));
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

    private ResponseEntity<?> invalidDraft(ProjectCommands.Draft draft) {
        if (draft.name().isBlank()) {
            return invalid("/name", "A project needs a name", "too_small");
        }
        if (draft.endsOn().compareTo(draft.startsOn()) < 0) {
            return invalid("/endsOn", "It cannot end before it starts", "invalid");
        }
        return null;
    }

    private ResponseEntity<?> invalid(String pointer, String detail, String issueCode) {
        Map<String, String> issue = new LinkedHashMap<>();
        issue.put("pointer", pointer);
        issue.put("code", issueCode);
        issue.put("detail", detail);
        return Problems.response(422, detail, "invalid", List.of(issue));
    }
}
