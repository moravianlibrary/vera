package cz.mzk.vera.login;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

// ACCESS-login-return.
class ReturnToTests {
    @Test
    void keepsAnInternalPathAndQuery() {
        assertThat(ReturnTo.safe("/documents?q=x")).isEqualTo("/documents?q=x");
    }

    @Test
    void usesTheHomePathForNullOrEmptyValues() {
        assertThat(ReturnTo.safe(null)).isEqualTo("/");
        assertThat(ReturnTo.safe("")).isEqualTo("/");
    }

    @Test
    void rejectsExternalAndProtocolRelativePaths() {
        assertThat(ReturnTo.safe("https://evil.example/")).isEqualTo("/");
        assertThat(ReturnTo.safe("//evil.example")).isEqualTo("/");
        assertThat(ReturnTo.safe("/\\evil.example")).isEqualTo("/");
    }

    @Test
    void rejectsLoginAndSignedOutPaths() {
        assertThat(ReturnTo.safe("/login?returnTo=/x")).isEqualTo("/");
        assertThat(ReturnTo.safe("/signed-out")).isEqualTo("/");
    }
}
