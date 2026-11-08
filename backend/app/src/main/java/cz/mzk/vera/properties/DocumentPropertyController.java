package cz.mzk.vera.properties;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

// DOC-property-hand: enter a property on one document or a selection.
@RestController
@RequestMapping("/api/documents")
final class DocumentPropertyController {
    private final PropertyEntryCommands entries;

    DocumentPropertyController(PropertyEntryCommands entries) {
        this.entries = entries;
    }

    @PutMapping("/{documentId}/properties/{key}")
    ResponseEntity<?> enter(HttpServletRequest request, @PathVariable String documentId,
            @PathVariable String key, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        return ActResult.answer(entries.enter(caller, documentId, key, body.path("value")));
    }

    @PostMapping("/properties/{key}")
    ResponseEntity<?> enterMany(HttpServletRequest request, @PathVariable String key,
            @RequestBody JsonNode body) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        ArrayList<String> documentIds = new ArrayList<>();
        body.path("documentIds").forEach(item -> documentIds.add(item.asString()));
        return ActResult.answer(entries.enterMany(caller, documentIds, key, body.path("value")));
    }

    private Caller caller(HttpServletRequest request) {
        return (Caller) request.getAttribute(Caller.class.getName());
    }
}
