package cz.mzk.vera.categories;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.session.Caller;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

// PLAN-tree; PLAN-counting; ACCESS-category-custody; PLAN-house-mix.
@RestController
@RequestMapping("/api/categories")
final class CategoriesController {
    private final CategoryReads reads;
    private final CategoryCommands commands;

    CategoriesController(CategoryReads reads, CategoryCommands commands) {
        this.reads = reads;
        this.commands = commands;
    }

    @GetMapping
    ResponseEntity<?> categories() {
        return ResponseEntity.ok(reads.categories());
    }

    @PostMapping
    ResponseEntity<?> create(HttpServletRequest request, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        return invalidName(body) ? invalidNameResponse() : ActResult.answer(commands.create(caller, body));
    }

    @PutMapping("/{categoryId}")
    ResponseEntity<?> save(HttpServletRequest request, @PathVariable String categoryId,
            @RequestBody JsonNode body) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (invalidName(body)) {
            return invalidNameResponse();
        }
        return ActResult.answer(commands.save(caller, categoryId, body));
    }

    @DeleteMapping("/{categoryId}")
    ResponseEntity<?> delete(HttpServletRequest request, @PathVariable String categoryId) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.delete(caller, categoryId));
    }

    @PutMapping("/{categoryId}/custody")
    ResponseEntity<?> custody(HttpServletRequest request, @PathVariable String categoryId,
            @RequestBody JsonNode body) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.custody(caller, categoryId, body));
    }

    @PostMapping("/{id}/refine")
    ResponseEntity<?> refine(HttpServletRequest request, @PathVariable String id, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (invalidName(body)) {
            return invalidNameResponse();
        }
        return ActResult.answer(commands.refine(caller, id, body));
    }

    @GetMapping("/overview")
    ResponseEntity<?> index(HttpServletRequest request, @RequestParam Map<String, String> parameters) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (!reads.canRead(caller.userId())) {
            return Problems.response(403, "You may not read categories");
        }
        return ResponseEntity.ok(reads.index(caller.userId(), parameters.get("mix")));
    }

    @GetMapping("/{categoryId}/impact")
    ResponseEntity<?> impact(HttpServletRequest request, @PathVariable String categoryId) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (!reads.canRead(caller.userId())) {
            return Problems.response(404, "No such category");
        }
        Map<String, Object> result = reads.impact(caller.userId(), categoryId);
        return result == null ? Problems.response(404, "No such category") : ResponseEntity.ok(result);
    }

    private Caller caller(HttpServletRequest request) {
        return (Caller) request.getAttribute(Caller.class.getName());
    }

    private boolean invalidName(JsonNode body) {
        return body.path("name").asString("").trim().isEmpty();
    }

    private ResponseEntity<?> invalidNameResponse() {
        String detail = "Too small: expected string to have >=1 characters";
        return Problems.response(422, detail, "invalid", List.of(Map.of(
                "pointer", "/name", "code", "too_small", "detail", detail)));
    }
}
