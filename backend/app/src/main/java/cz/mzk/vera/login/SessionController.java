package cz.mzk.vera.login;

import cz.mzk.vera.session.Caller;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** HTTP adapter for the signed-in person's session view. */
@RestController
@RequestMapping("/api/session")
final class SessionController {
    private final SessionQueries queries;

    SessionController(SessionQueries queries) { this.queries = queries; }

    @GetMapping
    ResponseEntity<?> session(HttpServletRequest request) {
        Caller caller = (Caller) request.getAttribute(Caller.class.getName());
        if (caller == null) return Problems.response(401, "Nobody is signed in.");
        SessionQueries.SessionView session = queries.session(caller);
        return session == null ? Problems.response(401, "Nobody is signed in.") : ResponseEntity.ok(session);
    }
}
