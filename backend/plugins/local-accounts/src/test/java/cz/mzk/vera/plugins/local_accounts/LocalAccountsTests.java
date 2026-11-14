package cz.mzk.vera.plugins.local_accounts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import cz.mzk.vera.plugin.PasswordCheck;
import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.identity.BeginInput;
import cz.mzk.vera.plugin.identity.CompleteAnswer;
import cz.mzk.vera.plugin.identity.CompleteInput;
import cz.mzk.vera.plugin.identity.IdentityRefusal;
import cz.mzk.vera.plugin.identity.IdentityRefused;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class LocalAccountsTests {
    @Test
    void startsWithAFormAndCompletesAValidLocalAccount() {
        LocalAccounts plugin = new LocalAccounts();
        TestContext context = new TestContext(PasswordCheck.MATCHES);

        assertEquals(null, plugin.begin(context, new BeginInput("/requests")).redirect());
        CompleteAnswer answer = plugin.complete(context, new CompleteInput.Form("reader", "password"));
        assertEquals("reader", answer.externalId());
        assertEquals("reader", answer.name());
        assertEquals(false, answer.emailVerified());
    }

    @Test
    void refusesMissingOrInvalidLocalPasswordsWithoutAnHttpFallback() {
        LocalAccounts plugin = new LocalAccounts();
        IdentityRefused wrong = assertThrows(IdentityRefused.class, () -> plugin.complete(
                new TestContext(PasswordCheck.DIFFERS), new CompleteInput.Form("reader", "bad")));
        IdentityRefused missing = assertThrows(IdentityRefused.class, () -> plugin.complete(
                new TestContext(PasswordCheck.NONE), new CompleteInput.Form("unknown", "bad")));

        assertEquals(IdentityRefusal.WRONG_CREDENTIALS.code(), wrong.code());
        assertEquals(IdentityRefusal.WRONG_CREDENTIALS.code(), missing.code());
    }

    @Test
    void refusesCallbackInput() {
        IdentityRefused refused = assertThrows(IdentityRefused.class, () -> new LocalAccounts().complete(
                new TestContext(PasswordCheck.MATCHES), new CompleteInput.Callback(Map.of())));

        assertEquals(IdentityRefusal.NOT_ALLOWED.code(), refused.code());
    }

    private record TestContext(PasswordCheck result) implements PluginContext {
        @Override
        public String instanceId() {
            return "pi24";
        }

        @Override
        public Map<String, String> configuration() {
            return Map.of("signup", "on", "password_min", "12", "mail_channel", "pi16");
        }

        @Override
        public Map<String, String> secrets() {
            return Map.of();
        }

        @Override
        public cz.mzk.vera.plugin.PluginHttp http() {
            throw new AssertionError("LocalAccounts must not make HTTP calls");
        }

        @Override
        public System.Logger logger() {
            return System.getLogger("test");
        }

        @Override
        public Clock clock() {
            return Clock.systemUTC();
        }

        @Override
        public cz.mzk.vera.plugin.LocalPasswords localPasswords() {
            return (username, password) -> result;
        }
    }
}
