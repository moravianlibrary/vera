package cz.mzk.vera.pluginhost;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PasswordCheck;
import cz.mzk.vera.plugin.propertysource.PropertySource;
import cz.mzk.vera.plugin.propertysource.ValuesAnswer;
import cz.mzk.vera.plugin.propertysource.ValuesInput;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.records.Iteration;
import cz.mzk.vera.plugin.registry.LookupAnswer;
import cz.mzk.vera.plugin.registry.LookupInput;
import cz.mzk.vera.plugin.registry.Registry;
import cz.mzk.vera.plugin.restriction.Restriction;
import cz.mzk.vera.plugin.restriction.RestrictionCheckAnswer;
import cz.mzk.vera.plugin.restriction.RestrictionCheckInput;
import cz.mzk.vera.plugin.validation.Validation;
import cz.mzk.vera.plugin.validation.ValidationCheckAnswer;
import cz.mzk.vera.plugin.validation.ValidationCheckInput;
import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.fakes.FakeIngest;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BiFunction;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import io.micrometer.observation.ObservationRegistry;
import tools.jackson.databind.ObjectMapper;

// PLG-api-kinds; PLG-api-outcome.
@SpringBootTest(classes = VeraTestingApplication.class)
@ActiveProfiles("test")
@Testcontainers
class IngestPluginCallsTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private PluginCalls calls;
    @Autowired
    private InstalledPlugins installed;
    @Autowired
    private TemplateResetService resetService;
    @Autowired
    private FakeIngest fakeIngest;
    @Autowired
    private DSLContext dsl;
    @Autowired
    private PluginSessions sessions;
    @Autowired
    private Clock clock;
    @Autowired
    private ObservationRegistry observations;
    @Autowired
    private ObjectMapper mapper;

    @BeforeEach
    void resetSeed() {
        resetService.reset("base", true);
    }

    @Test
    void registryAnswersD1FromPi4() {
        Document document = document("D1", "MZK01-001284756", "Lidové noviny", "Periodical");
        assertThat(registry("pi4", document)).isEqualTo(new LookupAnswer(List.of(
                new LookupAnswer.RegistryRecord("published", "https://kramerius.mzk.cz/view/uuid:demo"))));
    }

    @Test
    void propertySourceAnswersD1FromPi6() {
        assertThat(propertySource("pi6", document("D1", "MZK01-001284756", "Lidové noviny", "Periodical")))
                .isEqualTo(new ValuesAnswer(List.of()));
    }

    @Test
    void validationAnswersD1FromPi9() {
        assertThat(validation("pi9", document("D1", "MZK01-001284756", "Lidové noviny", "Periodical")))
                .isEqualTo(new ValidationCheckAnswer(List.of(new ValidationCheckAnswer.Defect(
                        "R07", "260$c", "MARC 260$c reads \"19uu\"; publication year cannot be resolved."))));
    }

    @Test
    void validationExcludesRepairedDefectAndKeepsOtherDefects() {
        Document repaired = document("D10", "MZK03-000445012", "Dějiny Velehradu", "Monograph");
        assertThat(validation("pi9", repaired)).isEqualTo(new ValidationCheckAnswer(List.of()));
        assertThat(validation("pi10", repaired))
                .isEqualTo(new ValidationCheckAnswer(List.of(new ValidationCheckAnswer.Defect(
                        "R01", "041$a", "MARC 041$a absent; language could not be determined from 008/35-37."))));
    }

    @Test
    void restrictionAnswersD6FromPi28() {
        assertThat(restriction("pi28", document("D6", "MZK05-000004412", "", "Monograph")))
                .isEqualTo(new RestrictionCheckAnswer(List.of(new RestrictionCheckAnswer.Finding(
                        "Conservation hold", true, null,
                        "Binding unstable; conservation report 2026/114 prohibits handling until restored.",
                        java.util.Map.of("cs", "Nelze digitalizovat kvůli fyzickému stavu.",
                                "en", "Not available for digitization (condition).")))));
    }

    @Test
    void registryAnswersIngestData() {
        resetIngest("\"registryRecords\":[{\"instanceId\":\"pi4\",\"identifiers\":[\"isbn1\",\"isbn2\"],"
                + "\"rawState\":\"Unknown\",\"link\":\"https://registry.test/item\"}]");
        assertThat(registry("pi4", document("NEW", "INGEST-NEW", "New item", "Map")))
                .isEqualTo(new LookupAnswer(List.of(new LookupAnswer.RegistryRecord(
                        "Unknown", "https://registry.test/item"))));
    }

    @Test
    void propertySourceAnswersIngestData() {
        resetIngest("\"properties\":[{\"key\":\"page_count\",\"value\":42,\"tier\":50,"
                + "\"instanceId\":\"pi6\"}]");
        assertThat(propertySource("pi6", document("NEW", "INGEST-NEW", "New item", "Map")))
                .isEqualTo(new ValuesAnswer(List.of(new ValuesAnswer.PropertyValue("page_count", 42L, 50))));
    }

    @Test
    void validationAnswersIngestData() {
        resetIngest("\"defects\":[{\"instanceId\":\"pi9\",\"rule\":\"R77\","
                + "\"field\":\"title\",\"detail\":\"Title needs review.\"}]");
        assertThat(validation("pi9", document("NEW", "INGEST-NEW", "New item", "Map")))
                .isEqualTo(new ValidationCheckAnswer(List.of(
                        new ValidationCheckAnswer.Defect("R77", "title", "Title needs review."))));
    }

    @Test
    void restrictionAnswersIngestData() {
        resetIngest("\"restriction\":{\"rule\":\"R-NEW\",\"forbidden\":true,"
                + "\"until\":\"2027-01-01T00:00:00Z\",\"why\":\"Review the rights.\","
                + "\"publicText\":{\"cs\":\"Zatím nelze.\"}}");
        assertThat(restriction("pi28", document("NEW", "INGEST-NEW", "New item", "Map")))
                .isEqualTo(new RestrictionCheckAnswer(List.of(new RestrictionCheckAnswer.Finding(
                        "R-NEW", true, java.time.Instant.parse("2027-01-01T00:00:00Z"), "Review the rights.",
                        java.util.Map.of("cs", "Zatím nelze.")))));
    }

    @Test
    void registryDefaultsForUnseededCatalog() {
        assertThat(registry("pi4", document("NEW", "NO-INGEST", "New item", "Map")))
                .isEqualTo(new LookupAnswer(List.of()));
    }

    @Test
    void propertySourceDefaultsForUnseededCatalog() {
        assertThat(propertySource("pi6", document("NEW", "NO-INGEST", "New item", "Map")))
                .isEqualTo(new ValuesAnswer(List.of()));
    }

    @Test
    void validationDefaultsForUnseededCatalog() {
        assertThat(validation("pi9", document("NEW", "NO-INGEST", "New item", "Map")))
                .isEqualTo(new ValidationCheckAnswer(List.of()));
    }

    @Test
    void restrictionDefaultsForUnseededCatalog() {
        assertThat(restriction("pi28", document("NEW", "NO-INGEST", "New item", "Map")))
                .isEqualTo(new RestrictionCheckAnswer(List.of()));
    }

    @Test
    void registryUnavailableFault() {
        fault("registry", "unavailable");
        assertThat(registryOutcome("pi4")).isInstanceOf(PluginOutcome.Unavailable.class);
    }

    @Test
    void registryMalformedFault() {
        fault("registry", "malformed");
        assertThat(registryOutcome("pi4")).isInstanceOf(PluginOutcome.Unavailable.class);
    }

    @Test
    void registryTimeoutFault() {
        fault("registry", "timeout");
        assertThat(shortCalls().call("pi4", Registry.class, "lookup", (plugin, context) ->
                plugin.lookup(context, new LookupInput(document("NEW", "FAULT-NEW", "", "Map"), List.of()))))
                .isInstanceOf(PluginOutcome.Unavailable.class);
    }

    @Test
    void propertySourceUnavailableFault() {
        fault("propertySource", "unavailable");
        assertThat(propertyOutcome("pi6")).isInstanceOf(PluginOutcome.Unavailable.class);
    }

    @Test
    void propertySourceMalformedFault() {
        fault("propertySource", "malformed");
        assertThat(propertyOutcome("pi6")).isInstanceOf(PluginOutcome.Unavailable.class);
    }

    @Test
    void propertySourceTimeoutFault() {
        fault("propertySource", "timeout");
        assertThat(shortCalls().call("pi6", PropertySource.class, "values", (plugin, context) ->
                plugin.values(context, valuesInput())))
                .isInstanceOf(PluginOutcome.Unavailable.class);
    }

    @Test
    void validationUnavailableFault() {
        fault("validation", "unavailable");
        assertThat(validationOutcome("pi9")).isInstanceOf(PluginOutcome.Unavailable.class);
    }

    @Test
    void validationMalformedFault() {
        fault("validation", "malformed");
        assertThat(validationOutcome("pi9")).isInstanceOf(PluginOutcome.Unavailable.class);
    }

    @Test
    void validationTimeoutFault() {
        fault("validation", "timeout");
        assertThat(shortCalls().call("pi9", Validation.class, "check", (plugin, context) ->
                plugin.check(context, validationInput())))
                .isInstanceOf(PluginOutcome.Unavailable.class);
    }

    @Test
    void restrictionUnavailableFault() {
        fault("restriction", "unavailable");
        assertThat(restrictionOutcome("pi28")).isInstanceOf(PluginOutcome.Unavailable.class);
    }

    @Test
    void restrictionMalformedFault() {
        fault("restriction", "malformed");
        assertThat(restrictionOutcome("pi28")).isInstanceOf(PluginOutcome.Unavailable.class);
    }

    @Test
    void restrictionTimeoutFault() {
        fault("restriction", "timeout");
        assertThat(shortCalls().call("pi28", Restriction.class, "check", (plugin, context) ->
                plugin.check(context, restrictionInput())))
                .isInstanceOf(PluginOutcome.Unavailable.class);
    }

    @Test
    void disabledRegistryInstanceIsNotCalled() {
        dsl.update(PLUGIN_INSTANCES)
                .set(PLUGIN_INSTANCES.IS_ENABLED, false)
                .where(PLUGIN_INSTANCES.ID.eq("pi4"))
                .execute();
        AtomicInteger invocations = new AtomicInteger();
        PluginOutcome<LookupAnswer> outcome = calls.call("pi4", Registry.class, "lookup", (plugin, context) -> {
            invocations.incrementAndGet();
            return plugin.lookup(context, new LookupInput(document("D1", "MZK01-001284756", "", "Periodical"),
                    List.of()));
        });
        assertThat(outcome).isInstanceOf(PluginOutcome.Unavailable.class);
        assertThat(invocations).hasValue(0);
    }

    private LookupAnswer registry(String instanceId, Document document) {
        PluginOutcome<LookupAnswer> outcome = calls.call(instanceId, Registry.class, "lookup",
                (plugin, context) -> plugin.lookup(context, new LookupInput(document, List.of("isbn1"))));
        return answered(outcome);
    }

    private ValuesAnswer propertySource(String instanceId, Document document) {
        Iteration iteration = new Iteration("IT-NEW", document.id(), 1, "R-NEW", "c1", "Normal", null,
                "Enqueued", null, null);
        return answered(calls.call(instanceId, PropertySource.class, "values",
                (plugin, context) -> plugin.values(context, new ValuesInput(document, iteration))));
    }

    private ValidationCheckAnswer validation(String instanceId, Document document) {
        return answered(calls.call(instanceId, Validation.class, "check",
                (plugin, context) -> plugin.check(context, new ValidationCheckInput(document, List.of()))));
    }

    private RestrictionCheckAnswer restriction(String instanceId, Document document) {
        return answered(calls.call(instanceId, Restriction.class, "check",
                (plugin, context) -> plugin.check(context, new RestrictionCheckInput(document, List.of()))));
    }

    private PluginOutcome<LookupAnswer> registryOutcome(String instanceId) {
        return calls.call(instanceId, Registry.class, "lookup", (plugin, context) ->
                plugin.lookup(context, new LookupInput(document("NEW", "FAULT-NEW", "", "Map"), List.of())));
    }

    private PluginOutcome<ValuesAnswer> propertyOutcome(String instanceId) {
        return calls.call(instanceId, PropertySource.class, "values", (plugin, context) ->
                plugin.values(context, valuesInput()));
    }

    private PluginOutcome<ValidationCheckAnswer> validationOutcome(String instanceId) {
        return calls.call(instanceId, Validation.class, "check", (plugin, context) ->
                plugin.check(context, validationInput()));
    }

    private PluginOutcome<RestrictionCheckAnswer> restrictionOutcome(String instanceId) {
        return calls.call(instanceId, Restriction.class, "check", (plugin, context) ->
                plugin.check(context, restrictionInput()));
    }

    private ValuesInput valuesInput() {
        Document document = document("NEW", "FAULT-NEW", "", "Map");
        return new ValuesInput(document, new Iteration("IT-NEW", "NEW", 1, "R-NEW", "c1", "Normal", null,
                "Enqueued", null, null));
    }

    private ValidationCheckInput validationInput() {
        return new ValidationCheckInput(document("NEW", "FAULT-NEW", "", "Map"), List.of());
    }

    private RestrictionCheckInput restrictionInput() {
        return new RestrictionCheckInput(document("NEW", "FAULT-NEW", "", "Map"), List.of());
    }

    private PluginCalls shortCalls() {
        return new PluginCalls(dsl, installed, sessions, clock, observations,
                instanceId -> (username, password) -> PasswordCheck.NONE, Duration.ofMillis(100));
    }

    private void resetIngest(String entry) {
        String seed = "{\"collections\":{\"documents\":[],\"iterations\":[]},"
                + "\"fakes\":{\"ingest\":{\"INGEST-NEW\":{" + entry + "}}}}";
        resetFake(seed);
    }

    private void fault(String kind, String value) {
        String seed = "{\"collections\":{\"documents\":[],\"iterations\":[]},"
                + "\"fakes\":{\"ingest\":{\"FAULT-NEW\":{\"faults\":{\""
                + kind + "\":\"" + value + "\"}}}}}";
        resetFake(seed);
    }

    private void resetFake(String seed) {
        try {
            fakeIngest.reset(mapper.readTree(seed));
        } catch (Exception exception) {
            throw new IllegalStateException("Could not arrange ingest fake test data.", exception);
        }
    }

    private Document document(String id, String catalogId, String title, String type) {
        return new Document(id, catalogId, null, title, type, null);
    }

    private <A> A answered(PluginOutcome<A> outcome) {
        assertThat(outcome).isInstanceOf(PluginOutcome.Answered.class);
        return ((PluginOutcome.Answered<A>) outcome).answer();
    }
}
