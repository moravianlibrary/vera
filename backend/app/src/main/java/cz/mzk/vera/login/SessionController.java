package cz.mzk.vera.login;

import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.SessionCommands;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// E14.
@RestController
@RequestMapping("/api/session")
final class SessionController {
    private final SessionQueries queries;
    private final SessionCommands commands;

    SessionController(SessionQueries queries, SessionCommands commands) {
        this.queries = queries;
        this.commands = commands;
    }

    @GetMapping
    ResponseEntity<?> session(HttpServletRequest request) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        SessionQueries.SessionView session = queries.session(caller);
        return session == null ? Problems.response(401, "Nobody is signed in.") : ResponseEntity.ok(session);
    }

    @DeleteMapping("/logout")
    ResponseEntity<Void> logout(HttpServletRequest request) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        commands.end(caller == null ? null : caller.tokenHash());
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, commands.clearedCookie()).build();
    }
}
