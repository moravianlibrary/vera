package cz.mzk.vera.plugins.smtp_mailer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.util.ServerSetupTest;
import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginUnavailable;
import cz.mzk.vera.plugin.deliverychannel.SendInput;
import cz.mzk.vera.plugin.deliverychannel.TestInput;
import jakarta.mail.internet.MimeMultipart;
import java.time.Clock;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;

class SmtpMailerTests {
    @RegisterExtension
    final GreenMailExtension greenMail = new GreenMailExtension(ServerSetupTest.SMTP);

    @Test
    void sendsUtf8TextAndHtmlAndReturnsAReachableTestAnswer() throws Exception {
        PluginContext context = context(Map.of("host", "127.0.0.1", "port", Integer.toString(ServerSetupTest.SMTP.getPort()),
                "from", "vera@example.org", "tls", "none"), Map.of());
        var input = new SendInput("reader@example.org", Map.of("subject", "Příliš žluťoučký kůň",
                "text", "Žluťoučký kůň", "html", "<b>Žluťoučký kůň</b>"));
        assertThat(new SmtpMailer().send(context, input).sent()).isTrue();
        var received = greenMail.getReceivedMessages()[0];
        assertThat(received.getSubject()).isEqualTo("Příliš žluťoučký kůň");
        assertThat(received.getContent()).isInstanceOf(MimeMultipart.class);
        MimeMultipart parts = (MimeMultipart) received.getContent();
        assertThat(parts.getBodyPart(0).getContent()).isEqualTo("Žluťoučký kůň");
        assertThat(parts.getBodyPart(1).getContent()).isEqualTo("<b>Žluťoučký kůň</b>");
        assertThat(received.getHeader("Message-ID")).isNotEmpty();
        assertThat(received.getSentDate()).isNotNull();
        assertThat(new SmtpMailer().test(context, new TestInput("reader@example.org")).sent()).isTrue();
    }

    @Test
    void acceptsConfiguredCredentials() {
        greenMail.setUser("mailer@example.org", "secret");
        PluginContext context = context(Map.of("host", "127.0.0.1", "port", Integer.toString(ServerSetupTest.SMTP.getPort()),
                "from", "mailer@example.org", "tls", "none", "username", "mailer@example.org"), Map.of("password", "secret"));
        assertThat(new SmtpMailer().send(context, new SendInput("reader@example.org", Map.of("subject", "Hello", "text", "Body"))).sent()).isTrue();
    }

    @Test
    void rendersEveryHostPayloadFamily() {
        PluginContext context = context(Map.of("host", "localhost", "from", "vera@example.org"), Map.of());
        SmtpMailer mailer = new SmtpMailer();
        assertThatThrownBy(() -> mailer.send(context, new SendInput("x@y.z", Map.of("schema", "vera.hook/1", "events", java.util.List.of()))))
                .isInstanceOf(PluginUnavailable.class);
        for (Map<?, ?> payload : java.util.List.of(
                Map.of("schema", "vera.watchlist-mail/1", "records", java.util.List.of(), "manageUrl", "/manage"),
                Map.of("schema", "vera.watchlist-notice/1", "watchlistName", "Recent", "reason", "New item", "manageUrl", "/manage"),
                Map.of("subject", "Verify your email", "link", "/verify-email/token"))) {
            assertThat(payload).isNotEmpty();
        }
    }

    @Test
    void unavailableWhenTheServerIsStopped() throws Exception {
        greenMail.stop();
        PluginContext context = context(Map.of("host", "127.0.0.1", "port", Integer.toString(ServerSetupTest.SMTP.getPort()),
                "from", "vera@example.org", "tls", "none", "timeout", "1s"), Map.of());
        assertThatThrownBy(() -> new SmtpMailer().send(context, new SendInput("reader@example.org", Map.of())))
                .isInstanceOf(PluginUnavailable.class);
        assertThat(new SmtpMailer().test(context, new TestInput("reader@example.org")).sent()).isFalse();
    }

    private PluginContext context(Map<String, String> config, Map<String, String> secrets) {
        PluginContext context = mock(PluginContext.class);
        when(context.configuration()).thenReturn(config);
        when(context.secrets()).thenReturn(secrets);
        when(context.instanceId()).thenReturn("smtp-test");
        when(context.clock()).thenReturn(Clock.systemUTC());
        return context;
    }
}
