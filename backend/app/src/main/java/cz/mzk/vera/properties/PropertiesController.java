package cz.mzk.vera.properties;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

// ACT-property-create; ACT-property-save; ACT-property-delete: thin routes for the properties feature.
@RestController
@RequestMapping("/api/properties")
final class PropertiesController {
    private final PropertyQueries queries;
    private final PropertyCommands commands;

    PropertiesController(PropertyQueries queries, PropertyCommands commands) {
        this.queries = queries;
        this.commands = commands;
    }

    @GetMapping
    ResponseEntity<?> index(HttpServletRequest request) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        return ResponseEntity.ok(queries.index(caller));
    }

    @PostMapping
    ResponseEntity<?> create(HttpServletRequest request, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        return ActResult.answer(commands.create(caller, body.path("key").asString(), body.path("draft")));
    }

    @PutMapping("/{id}")
    ResponseEntity<?> save(HttpServletRequest request, @PathVariable String id, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        return ActResult.answer(commands.save(caller, id, body));
    }

    @GetMapping("/{id}/impact")
    ResponseEntity<?> impact(HttpServletRequest request, @PathVariable String id) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        return ActResult.answer(queries.impact(caller, id));
    }

    @DeleteMapping("/{id}")
    ResponseEntity<?> delete(HttpServletRequest request, @PathVariable String id) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        return ActResult.answer(commands.delete(caller, id));
    }

    private Caller caller(HttpServletRequest request) {
        return (Caller) request.getAttribute(Caller.class.getName());
    }
}
