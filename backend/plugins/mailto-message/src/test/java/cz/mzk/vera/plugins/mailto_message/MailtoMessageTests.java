package cz.mzk.vera.plugins.mailto_message;

import static org.junit.jupiter.api.Assertions.assertEquals;

import cz.mzk.vera.plugin.message.HandOffInput;
import cz.mzk.vera.plugin.message.HandOffAnswer;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MailtoMessageTests {
    @Test
    void createsMailtoAddressAndCopiesSenderWhenConfigured() {
        MailtoMessage plugin = new MailtoMessage();
        TestContext context = new TestContext(Map.of("cc_sender", "on"));
        HandOffAnswer answer = plugin.handOff(context,
                new HandOffInput(List.of("reader@example.test"), "A subject", "A body", "staff@example.test"));

        assertEquals("mailto:reader@example.test?subject=A%20subject&body=A%20body&cc=staff%40example.test",
                answer.address());
        assertEquals(false, answer.sent());
    }

    @Test
    void doesNotCopySenderWhenDisabled() {
        MailtoMessage plugin = new MailtoMessage();
        HandOffAnswer answer = plugin.handOff(new TestContext(Map.of("cc_sender", "off")),
                new HandOffInput(List.of("reader@example.test"), "Subject", "Body", "staff@example.test"));

        assertEquals("mailto:reader@example.test?subject=Subject&body=Body", answer.address());
    }
}
