package cz.mzk.vera.intentions;

import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// PLAN-counting; PLAN-mix-reading; ACT-refusal: serve intention reads and write-free previews.
@RestController
@RequestMapping("/api/intentions")
final class IntentionsController {
    private final IntentionReads reads;
    private final JsonMapper mapper;

    IntentionsController(IntentionReads reads, JsonMapper mapper) {
        this.reads = reads;
        this.mapper = mapper;
    }

    @GetMapping("/overview")
    ResponseEntity<?> overview(HttpServletRequest request) {
        Caller caller = caller(request);
        ResponseEntity<?> refusal = requireRead(caller);
        return refusal == null ? ResponseEntity.ok(reads.overview(caller.userId())) : refusal;
    }

    @GetMapping("/{intentionId}/mix")
    ResponseEntity<?> mix(HttpServletRequest request, @PathVariable String intentionId) {
        Caller caller = caller(request);
        ResponseEntity<?> refusal = requireRead(caller);
        if (refusal != null) {
            return refusal;
        }
        Map<String, Object> result = reads.mix(caller.userId(), intentionId);
        return result == null ? Problems.response(404, "Intention not found") : ResponseEntity.ok(result);
    }

    @GetMapping("/{intentionId}/correction")
    ResponseEntity<?> correction(HttpServletRequest request, @PathVariable String intentionId,
        @RequestParam(required = false) String pages) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        int pageCount;
        try {
            pageCount = Integer.parseInt(pages);
        } catch (NumberFormatException exception) {
            return Problems.response(
                422, "Say how many pages the list is for", "list.page_count_required", null);
        }
        if (pageCount <= 0) {
            return Problems.response(
                422, "Say how many pages the list is for", "list.page_count_required", null);
        }
        return reads.correction(caller.userId(), intentionId, pageCount);
    }

    @GetMapping("/{intentionId}/deletion")
    ResponseEntity<?> deletion(HttpServletRequest request, @PathVariable String intentionId) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        return reads.deletion(caller.userId(), intentionId);
    }

    @PostMapping("/preview")
    ResponseEntity<?> preview(HttpServletRequest request, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        return reads.preview(caller.userId(), body, mapper);
    }

    private Caller caller(HttpServletRequest request) {
        return (Caller) request.getAttribute(Caller.class.getName());
    }

    private ResponseEntity<?> requireRead(Caller caller) {
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (!reads.canRead(caller.userId())) {
            return Problems.response(403, "You may not read intentions");
        }
        return null;
    }
}
