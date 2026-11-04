package cz.mzk.vera.login;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** HTTP adapter for login entry discovery. */
@RestController
@RequestMapping("/api/login")
final class LoginController {
    private final LoginQueries queries;

    LoginController(LoginQueries queries) { this.queries = queries; }

    @GetMapping
    List<LoginQueries.LoginEntry> loginEntries() {
        return queries.loginEntries();
    }
}
