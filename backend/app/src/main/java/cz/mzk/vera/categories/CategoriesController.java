package cz.mzk.vera.categories;

import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// PLAN-tree; PLAN-counting; ACCESS-category-custody; PLAN-house-mix.
@RestController
@RequestMapping("/api/categories")
final class CategoriesController {
    private final CategoryReads reads;

    CategoriesController(CategoryReads reads) {
        this.reads = reads;
    }

    @GetMapping
    ResponseEntity<?> categories() {
        return ResponseEntity.ok(reads.categories());
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
}
