package cz.mzk.vera.login;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PasswordsTests {
    private final Passwords passwords = new Passwords();

    @Test
    void hashesWithArgon2idAndMatchesOnlyThePassword() {
        String hash = passwords.hash("correct horse battery staple");
        assertThat(hash).startsWith("$argon2id$");
        assertThat(passwords.matches("correct horse battery staple", hash)).isTrue();
        assertThat(passwords.matches("another password", hash)).isFalse();
    }
}
