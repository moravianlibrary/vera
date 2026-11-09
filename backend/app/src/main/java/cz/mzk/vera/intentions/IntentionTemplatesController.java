package cz.mzk.vera.intentions;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import tools.jackson.databind.JsonNode;

// ACT-repeat-save; serve repeat creation and changes through IntentionCommands.
@RestController
@RequestMapping("/api/intention-templates")
final class IntentionTemplatesController {
    private final IntentionCommands commands;

    IntentionTemplatesController(IntentionCommands commands) {
        this.commands = commands;
    }

    @PostMapping
    ResponseEntity<?> create(HttpServletRequest request, @RequestBody JsonNode body) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        return caller == null
                ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.createTemplate(caller, body));
    }

    @PutMapping("/{templateId}")
    ResponseEntity<?> save(
            HttpServletRequest request,
            @PathVariable String templateId,
            @RequestBody JsonNode body) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        return caller == null
                ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.saveTemplate(caller, templateId, body));
    }
}
