package cz.mzk.vera.login;

import cz.mzk.vera.login.SignUpCommands.ResetResult;
import cz.mzk.vera.login.SignUpCommands.ResetStatus;
import cz.mzk.vera.login.SignUpCommands.SignUpResult;
import cz.mzk.vera.session.SessionCommands;
import cz.mzk.vera.web.Problems;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// ACCESS-sign-up; ACCESS-verify-email; ACCESS-password-reset; ACCESS-no-enumeration.
@RestController
@RequestMapping("/api")
final class SignUpController {
    private static final String LINK_EXPIRED = "This link has expired.";
    private final SignUpCommands commands;
    private final SessionCommands sessions;

    SignUpController(SignUpCommands commands, SessionCommands sessions) {
        this.commands = commands;
        this.sessions = sessions;
    }

    @PostMapping("/signup/{instanceId}")
    ResponseEntity<?> signUp(@PathVariable String instanceId, @RequestBody SignUpCommands.SignUp body) {
        SignUpResult result = commands.signUp(instanceId, body);
        if (result == SignUpResult.NOT_AVAILABLE) {
            return Problems.response(404, "There is no sign-up for this instance.");
        }
        if (result == SignUpResult.PASSWORD_SHORT) {
            return Problems.response(422, "The password is too short.", "access.password_short", null);
        }
        if (result == SignUpResult.USERNAME_TAKEN) {
            return Problems.response(422, "That username is taken.", "access.username_taken", null);
        }
        if (result == SignUpResult.TOO_MANY_MAILS) {
            return Problems.response(429, "Too many verification emails.",
                    "access.too_many_verification_emails", null);
        }
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/email-verification/{instanceId}")
    ResponseEntity<Void> sendAgain(@PathVariable String instanceId, @RequestBody EmailBody body) {
        commands.resend(instanceId, body.email());
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/email-verification/confirm")
    ResponseEntity<?> confirm(@RequestBody TokenBody body) {
        SignUpCommands.Confirmed confirmed = commands.confirm(body.token());
        if (confirmed == null) {
            return Problems.response(410, LINK_EXPIRED, "access.link_expired", null);
        }
        String token = sessions.open(confirmed.userId(), confirmed.instanceId());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, sessions.cookie(token))
                .body(new Verified(confirmed.returnTo()));
    }

    @PostMapping("/password-reset/{instanceId}")
    ResponseEntity<Void> requestReset(@PathVariable String instanceId, @RequestBody EmailBody body) {
        commands.requestReset(instanceId, body.email());
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/password-reset/confirm")
    ResponseEntity<?> reset(@RequestBody ResetBody body) {
        ResetResult result = commands.resetPassword(body.token(), body.password());
        if (result.status() == ResetStatus.EXPIRED) {
            return Problems.response(410, LINK_EXPIRED, "access.link_expired", null);
        }
        if (result.status() == ResetStatus.PASSWORD_SHORT) {
            return Problems.response(422, "The password is too short.", "access.password_short", null);
        }
        String token = sessions.open(result.userId(), result.instanceId());
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, sessions.cookie(token)).build();
    }

    record EmailBody(String email) {}
    record TokenBody(String token) {}
    record ResetBody(String token, String password) {}
    record Verified(String returnTo) {}
}
