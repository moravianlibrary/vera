package cz.mzk.vera.plugin;

// ACCESS-local-account.
public interface LocalPasswords {
    PasswordCheck check(String username, String password);
}
