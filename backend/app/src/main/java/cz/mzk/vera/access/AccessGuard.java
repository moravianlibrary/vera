package cz.mzk.vera.access;

import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

// ACCESS-read: only a signed-in person holding access.manage may change access.
@Component
public class AccessGuard {
    private final HeldAccessQueries heldAccess;

    public AccessGuard(HeldAccessQueries heldAccess) {
        this.heldAccess = heldAccess;
    }

    public Caller callerOf(HttpServletRequest request) {
        return (Caller) request.getAttribute(Caller.class.getName());
    }

    public ResponseEntity<ProblemDetail> requireCaller(Caller caller) {
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        return null;
    }

    public ResponseEntity<ProblemDetail> requireManage(Caller caller) {
        ResponseEntity<ProblemDetail> refusal = requireCaller(caller);
        if (refusal != null) {
            return refusal;
        }
        if (!Permissions.hasPermission(heldAccess.heldBy(caller.userId()).grants(), "access.manage")) {
            return Problems.response(403, "You may not change users, groups or roles");
        }
        return null;
    }
}
