package cz.mzk.vera.plugins;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
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

// ACT-instance-create; ACT-instance-save; ACT-instance-disable; ACT-instance-delete; ACT-instance-run;
// PLG-model; PLG-secrets; PLG-run-items.
@RestController
@RequestMapping("/api")
class PluginsController {
    private final PluginQueries queries;
    private final PluginCommands commands;
    private final HeldAccessQueries access;

    PluginsController(PluginQueries queries, PluginCommands commands, HeldAccessQueries access) {
        this.queries = queries;
        this.commands = commands;
        this.access = access;
    }

    @GetMapping("/plugins")
    ResponseEntity<?> plugins(HttpServletRequest request) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (!queries.canRead(caller.userId())) {
            return Problems.response(403, "You may not read plugins");
        }
        return ResponseEntity.ok(queries.index(caller.userId()));
    }

    @GetMapping("/plugin-instances")
    ResponseEntity<?> instances() {
        return ResponseEntity.ok(queries.instances());
    }

    @PostMapping("/plugin-instances")
    ResponseEntity<?> create(HttpServletRequest request, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.create(caller, body));
    }

    @PutMapping("/plugin-instances/{id}")
    ResponseEntity<?> save(HttpServletRequest request, @PathVariable String id, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.save(caller, id, body));
    }

    @DeleteMapping("/plugin-instances/{id}")
    ResponseEntity<?> delete(HttpServletRequest request, @PathVariable String id) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.delete(caller, id));
    }

    @PostMapping("/plugin-instances/{id}/enable")
    ResponseEntity<?> enable(HttpServletRequest request, @PathVariable String id) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.setEnabled(caller, id, true));
    }

    @PostMapping("/plugin-instances/{id}/disable")
    ResponseEntity<?> disable(HttpServletRequest request, @PathVariable String id) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.setEnabled(caller, id, false));
    }

    @GetMapping("/plugin-instances/{id}/impact")
    ResponseEntity<?> impact(HttpServletRequest request, @PathVariable String id) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (!Permissions.hasPermission(access.heldBy(caller.userId()).grants(), "plugin.configure")) {
            return Problems.response(403, "You may not configure plugins");
        }
        Map<String, Object> impact = queries.impact(id, caller.userId());
        return impact == null ? Problems.response(404, "No such plugin instance") : ResponseEntity.ok(impact);
    }

    @PostMapping("/plugin-instances/{id}/run")
    ResponseEntity<?> run(HttpServletRequest request, @PathVariable String id) {
        Caller caller = caller(request);
        return caller == null ? Problems.response(401, "Nobody is signed in.")
                : ActResult.answer(commands.runNow(caller, id));
    }

    private Caller caller(HttpServletRequest request) {
        return (Caller) request.getAttribute(Caller.class.getName());
    }
}
