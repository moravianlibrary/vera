package cz.mzk.vera.testing.fakes;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.plugin.deliverychannel.DeliveryChannel;
import cz.mzk.vera.plugin.deliverychannel.SendInput;
import cz.mzk.vera.plugin.deliverychannel.TestInput;
import cz.mzk.vera.plugin.harvester.HarvestAnswer;
import cz.mzk.vera.plugin.harvester.Harvester;
import cz.mzk.vera.plugin.harvester.HarvestInput;
import cz.mzk.vera.plugin.message.HandOffInput;
import cz.mzk.vera.plugin.message.Message;
import cz.mzk.vera.plugin.publicationdetector.DetectInput;
import cz.mzk.vera.plugin.publicationdetector.PublicationDetector;
import cz.mzk.vera.plugin.records.Iteration;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import cz.mzk.vera.testing.seeds.SeedReader;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(classes = VeraTestingApplication.class)
@ActiveProfiles("test")
@Testcontainers
// PLG-api-kinds; fakes.md Harvester, Publication detector, Delivery channel and Message.
class AdditionalPluginFakesTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired private PluginCalls calls;
    @Autowired private TemplateResetService resetService;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private FakeRecords fakeRecords;
    @Autowired private SeedReader seedReader;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void resetSeed() { resetService.reset("base", true); }

    @Test
    void periodicalHarvesterReturnsBothPagesAndCursor() {
        HarvestAnswer first = answer(calls.call("pi8", Harvester.class, "harvest",
                (plugin, context) -> plugin.harvest(context, new HarvestInput(null))));
        HarvestAnswer second = answer(calls.call("pi8", Harvester.class, "harvest",
                (plugin, context) -> plugin.harvest(context, new HarvestInput(first.nextCursor()))));
        assertThat(first.items()).hasSize(2);
        assertThat(first.nextCursor()).isEqualTo("1");
        assertThat(second.items()).hasSize(2);
        assertThat(second.nextCursor()).isNull();
    }

    @Test
    void krameriusHarvesterReturnsItsEmptyPage() {
        HarvestAnswer page = answer(calls.call("pi29", Harvester.class, "harvest",
                (plugin, context) -> plugin.harvest(context, new HarvestInput(null))));
        assertThat(page.items()).isEmpty();
        assertThat(page.nextCursor()).isNull();
    }

    @Test
    void publicationDetectorUsesMockPidAndCanonicalLinkForDigitizedIterations() {
        Iteration iteration = new Iteration("IT1", "D1", 1, "R1", "c1", "Normal", null,
                "Digitized", null, null);
        var result = answer(calls.call("pi33", PublicationDetector.class, "detect",
                (plugin, context) -> plugin.detect(context, new DetectInput(List.of(iteration)))));
        // From links.ts pidOf("IT1") and canonicalLinkOf, using the seeded Link instance pi32.
        assertThat(result.links()).containsExactly(new cz.mzk.vera.plugin.publicationdetector.DetectAnswer.FoundLink(
                "IT1", "https://www.digitalniknihovna.cz/mzk/uuid/uuid:00000000-0000-4000-8000-000000495431"));
    }

    @Test
    void deliveryChannelsSendAndTestIntoOutboxWithTheirChannel() {
        for (String instance : List.of("pi16", "pi17", "pi18", "pi20", "pi21")) {
            answer(calls.call(instance, DeliveryChannel.class, "send",
                    (plugin, context) -> plugin.send(context, new SendInput("reader@example.test", Map.of("text", "hello")))));
            answer(calls.call(instance, DeliveryChannel.class, "test",
                    (plugin, context) -> plugin.test(context, new TestInput("reader@example.test"))));
        }
        assertThat(jdbc.queryForList("SELECT DISTINCT channel FROM outbox ORDER BY channel", String.class))
                .containsExactly("chat", "file", "mail", "webhook");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM outbox", Integer.class)).isEqualTo(10);
        assertThat(jdbc.queryForObject("SELECT payload->>'text' FROM outbox LIMIT 1", String.class))
                .isEqualTo("hello");
    }

    @Test
    void deliveryFaultMakesSendUnavailableAndRejectsNamedRecipient() {
        JsonNode seed = seedReader.read("base");
        var changed = (tools.jackson.databind.node.ObjectNode) seed.deepCopy();
        var delivery = changed.withObject("faults").withObject("deliveryChannel");
        delivery.putArray("unavailableInstances").add("pi16");
        delivery.putArray("rejectedRecipients").add("blocked@example.test");
        fakeRecords.reset(changed);
        PluginOutcome<?> unavailable = calls.call("pi16", DeliveryChannel.class, "send",
                (plugin, context) -> plugin.send(context, new SendInput("ok@example.test", Map.of())));
        PluginOutcome<?> refused = calls.call("pi17", DeliveryChannel.class, "send",
                (plugin, context) -> plugin.send(context,
                        new SendInput("blocked@example.test", Map.of())));
        assertThat(unavailable).isInstanceOf(PluginOutcome.Unavailable.class);
        assertThat(refused).isEqualTo(new PluginOutcome.Refused<>("recipient_rejected", "Recipient rejected."));
    }

    @Test
    void messageInstancesReturnMailAndSlackHandoffsAndBotSends() {
        var email = answer(calls.call("pi26", Message.class, "handOff",
                (plugin, context) -> plugin.handOff(context,
                        new HandOffInput(List.of("reader@example.test"), "Subject", "Body", null))));
        var slack = answer(calls.call("pi27", Message.class, "handOff",
                (plugin, context) -> plugin.handOff(context,
                        new HandOffInput(List.of("u3"), "Subject", "Body", null))));
        var bot = answer(calls.call("pi44", Message.class, "handOff",
                (plugin, context) -> plugin.handOff(context,
                        new HandOffInput(List.of("u3"), "Subject", "Body", null))));
        assertThat(email.address()).startsWith("mailto:");
        assertThat(slack.address()).contains("slack.com/app_redirect").contains("pdvorak");
        assertThat(bot.sent()).isTrue();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM outbox WHERE channel='chat'", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void pluginLoaderLoadsTheAddedJarKinds() {
        for (String[] item : List.of(new String[] {"pi8", "Harvester"}, new String[] {"pi29", "Harvester"},
                new String[] {"pi33", "PublicationDetector"}, new String[] {"pi16", "DeliveryChannel"},
                new String[] {"pi17", "DeliveryChannel"}, new String[] {"pi18", "DeliveryChannel"},
                new String[] {"pi20", "DeliveryChannel"}, new String[] {"pi21", "DeliveryChannel"},
                new String[] {"pi26", "Message"}, new String[] {"pi27", "Message"},
                new String[] {"pi44", "Message"})) {
            assertThat(jdbc.queryForObject("SELECT is_enabled FROM plugin_instances WHERE id=?", Boolean.class,
                    item[0])).isTrue();
            assertThat(item[1]).isNotBlank();
        }
    }

    @SuppressWarnings("unchecked")
    private <A> A answer(PluginOutcome<A> outcome) {
        assertThat(outcome).isInstanceOf(PluginOutcome.Answered.class);
        return (A) ((PluginOutcome.Answered<?>) outcome).answer();
    }
}
