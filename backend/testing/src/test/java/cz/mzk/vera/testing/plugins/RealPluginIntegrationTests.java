package cz.mzk.vera.testing.plugins;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.plugin.LocalPasswords;
import cz.mzk.vera.plugin.PasswordCheck;
import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.identity.BeginInput;
import cz.mzk.vera.plugin.identity.CompleteAnswer;
import cz.mzk.vera.plugin.identity.CompleteInput;
import cz.mzk.vera.plugin.identity.Identity;
import cz.mzk.vera.plugin.classifier.Classifier;
import cz.mzk.vera.plugin.classifier.SuggestInput;
import cz.mzk.vera.plugin.classifier.Suggestion;
import cz.mzk.vera.plugin.custody.Custody;
import cz.mzk.vera.plugin.custody.PlaceInput;
import cz.mzk.vera.plugin.input.EntryLinkInput;
import cz.mzk.vera.plugin.input.EntryLinkInput.CatalogId;
import cz.mzk.vera.plugin.listgenerator.GenerateAnswer;
import cz.mzk.vera.plugin.listgenerator.GenerateInput;
import cz.mzk.vera.plugin.listgenerator.ListGenerator;
import cz.mzk.vera.plugin.message.HandOffAnswer;
import cz.mzk.vera.plugin.message.HandOffInput;
import cz.mzk.vera.plugin.message.Message;
import cz.mzk.vera.plugin.propertysource.PropertySource;
import cz.mzk.vera.plugin.propertysource.ValuesAnswer;
import cz.mzk.vera.plugin.propertysource.ValuesInput;
import cz.mzk.vera.plugin.records.Category;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.records.Iteration;
import cz.mzk.vera.plugin.records.Request;
import cz.mzk.vera.pluginhost.PluginDeclarations;
import cz.mzk.vera.pluginhost.PluginLoader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Enumeration;
import java.io.InputStream;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// PLG-api-kinds; ACCESS-local-account; MSG-handoff.
class RealPluginIntegrationTests {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void signedPackagesLoadAndAnswerWithSeededConfigurations() throws Exception {
        Path seedPath = Path.of(System.getenv("VERA_SEEDS_DIR"), "base.json");
        JsonNode seed = JSON.readTree(Files.readAllBytes(seedPath));
        Map<String, JsonNode> configurations = configurations(seed);
        Map<String, String> custodyIds = custodyIds(seed);
        Path packages = Path.of(System.getProperty("vera.plugin.packages"));
        PluginDeclarations declarations = new PluginDeclarations(System.getenv("VERA_CONTRACT_DIR"));
        Path cache = Files.createTempDirectory("vera-plugin-integration-");
        PluginLoader loader = new PluginLoader(declarations, cache.toString());

        verifySigned(packages.resolve("mailto-message-1.1.0.jar"));
        try (PluginLoader.LoadedPlugin loaded = loader.load(
                Files.readAllBytes(packages.resolve("mailto-message-1.1.0.jar")))) {
            Message plugin = (Message) loaded.implementation();
            TestContext context = new TestContext("pi26", strings(configurations.get("pi26")),
                    (username, password) -> PasswordCheck.NONE);
            HandOffAnswer answer = plugin.handOff(context,
                    new HandOffInput(List.of("reader@example.test"), "[VERA] Subject", "Context\n\nhttps://vera.test", null));
            assertThat(answer.address()).isEqualTo(
                    "mailto:reader@example.test?subject=%5BVERA%5D%20Subject&body=Context%0A%0Ahttps%3A%2F%2Fvera.test");
            assertThat(answer.sent()).isFalse();
        }

        verifySigned(packages.resolve("local-accounts-1.1.0.jar"));
        try (PluginLoader.LoadedPlugin loaded = loader.load(
                Files.readAllBytes(packages.resolve("local-accounts-1.1.0.jar")))) {
            Identity plugin = (Identity) loaded.implementation();
            TestContext context = new TestContext("pi24", strings(configurations.get("pi24")),
                    (username, password) -> "reader".equals(username) && "secret".equals(password)
                            ? PasswordCheck.MATCHES : PasswordCheck.NONE);
            assertThat(plugin.begin(context, new BeginInput("/requests")).redirect()).isNull();
            CompleteAnswer answer = plugin.complete(context, new CompleteInput.Form("reader", "secret"));
            assertThat(answer.externalId()).isEqualTo("reader");
            assertThat(answer.name()).isEqualTo("reader");
            assertThat(context.configuration()).containsEntry("signup", "on")
                    .containsEntry("password_min", "12").containsEntry("mail_channel", "pi16");
        }

        verifySigned(packages.resolve("entry-link-1.1.0.jar"));
        try (PluginLoader.LoadedPlugin loaded = loader.load(
                Files.readAllBytes(packages.resolve("entry-link-1.1.0.jar")))) {
            EntryLinkInput plugin = (EntryLinkInput) loaded.implementation();
            TestContext context = new TestContext("pi43", strings(configurations.get("pi43")),
                    (username, password) -> PasswordCheck.NONE);
            EntryLinkInput.EntryAnswer answer = plugin.entry(context,
                    new EntryLinkInput.EntryInput(Map.of("sysno", "MZK01-001234567", "unit", "volume 2",
                            "reason", "Research"), "https://www.mzk.cz/digitize"));
            assertThat(answer.item()).isEqualTo(new CatalogId("MZK01-001234567"));
            assertThat(answer.unit()).isEqualTo("volume 2");
            assertThat(answer.reason()).isEqualTo("Research");
            assertThat(answer.origin()).isEqualTo("https://www.mzk.cz");
        }

        verifySigned(packages.resolve("material-type-1.2.0.jar"));
        try (PluginLoader.LoadedPlugin loaded = loader.load(
                Files.readAllBytes(packages.resolve("material-type-1.2.0.jar")))) {
            Classifier plugin = (Classifier) loaded.implementation();
            TestContext context = new TestContext("pi31", strings(configurations.get("pi31")),
                    (username, password) -> PasswordCheck.NONE);
            Suggestion answer = plugin.suggest(context, new SuggestInput(
                    new Request("r1", "d1", null, null, null, null, null, null, null, null),
                    new Document("d1", null, null, "Title", "Periodical", null))).orElseThrow();
            assertThat(answer.category().id()).isEqualTo("c22");
            assertThat(answer.why()).isEqualTo("Document type: Periodical");
        }

        verifySigned(packages.resolve("shelf-mark-to-size-1.1.0.jar"));
        try (PluginLoader.LoadedPlugin loaded = loader.load(
                Files.readAllBytes(packages.resolve("shelf-mark-to-size-1.1.0.jar")))) {
            PropertySource plugin = (PropertySource) loaded.implementation();
            ValuesAnswer answer = plugin.values(new TestContext("pi48", Map.of(),
                            (username, password) -> PasswordCheck.NONE),
                    new ValuesInput(new Document("d1", null, null, "Title", "Book", "ST1-0032"), null));
            assertThat(answer.values()).isEmpty();
        }

        verifySigned(packages.resolve("jq-custody-1.1.0.jar"));
        try (PluginLoader.LoadedPlugin loaded = loader.load(
                Files.readAllBytes(packages.resolve("jq-custody-1.1.0.jar")))) {
            Custody plugin = (Custody) loaded.implementation();
            Request request = new Request("r1", "d1", null, null, null, null,
                    "p3", "Moravica", null, "Pending");
            Document document = new Document("d1", null, null, "Title", "Periodical", null);
            assertThat(plugin.place(new TestContext("pi25", strings(configurations.get("pi25")),
                            (username, password) -> PasswordCheck.NONE),
                    new PlaceInput(request, document, custodyIds.get("pi25"))).custodies())
                    .containsExactly("pc1");
            assertThat(plugin.place(new TestContext("pi34", strings(configurations.get("pi34")),
                            (username, password) -> PasswordCheck.NONE),
                    new PlaceInput(request, document, custodyIds.get("pi34"))).custodies()).isEmpty();
            assertThat(plugin.place(new TestContext("pi35", strings(configurations.get("pi35")),
                            (username, password) -> PasswordCheck.NONE),
                    new PlaceInput(request, document, custodyIds.get("pi35"))).custodies())
                    .containsExactly("pc3");
        }

        verifySigned(packages.resolve("priority-then-mix-1.3.0.jar"));
        try (PluginLoader.LoadedPlugin loaded = loader.load(
                Files.readAllBytes(packages.resolve("priority-then-mix-1.3.0.jar")))) {
            ListGenerator plugin = (ListGenerator) loaded.implementation();
            GenerateInput input = new GenerateInput(new GenerateInput.ShapingIntention("i4", "Overall output"),
                    false, List.of(
                            new GenerateInput.Leaf(new Category("c11", "North", "c1"), "c1", null, null),
                            new GenerateInput.Leaf(new Category("c12", "South", "c1"), "c1", null, null)),
                    List.of(), List.of(
                            generatorItem("IT30", "c11", "Normal", 188, "2026-05-21T08:00:00.000Z"),
                            generatorItem("IT31", "c12", "High", 264, "2026-05-18T08:00:00.000Z")),
                    List.of(), 1000, List.of(), null);
            GenerateAnswer answer = plugin.generate(new TestContext("pi14", strings(configurations.get("pi14")),
                    (username, password) -> PasswordCheck.NONE), input);
            JsonNode recording = JSON.readTree(Path.of("../../replay/recordings/base-lists.json").toFile());
            JsonNode generated = scenario(recording, "generate-list-draft").path("calls").get(0).path("body");
            assertThat(answer.picks()).extracting(GenerateAnswer.Pick::iterationId)
                    .containsExactly(generated.path("picks").get(0).path("item").path("iteration").path("id")
                            .asString(), generated.path("picks").get(1).path("item").path("iteration").path("id")
                            .asString());
            assertThat(answer.picks()).extracting(GenerateAnswer.Pick::why)
                    .containsExactly(generated.path("picks").get(0).path("reason").asString(),
                            generated.path("picks").get(1).path("reason").asString());
        }
    }

    private Map<String, JsonNode> configurations(JsonNode seed) {
        Map<String, JsonNode> result = new HashMap<>();
        for (JsonNode instance : seed.path("collections").path("pluginInstances")) {
            String id = instance.path("id").asString();
            if ("pi14".equals(id) || "pi24".equals(id) || "pi26".equals(id)
                    || "pi31".equals(id) || "pi43".equals(id)
                    || "pi25".equals(id) || "pi34".equals(id) || "pi35".equals(id)) {
                result.put(id, instance.path("configuration"));
            }
        }
        assertThat(result).containsKeys("pi14", "pi24", "pi26", "pi31", "pi43", "pi25", "pi34", "pi35");
        return result;
    }

    private Map<String, String> custodyIds(JsonNode seed) {
        Map<String, String> result = new HashMap<>();
        for (JsonNode instance : seed.path("collections").path("pluginInstances")) {
            String id = instance.path("id").asString();
            if ("pi25".equals(id) || "pi34".equals(id) || "pi35".equals(id)) {
                result.put(id, instance.path("settings").path("custodyId").asString(null));
            }
        }
        assertThat(result).containsEntry("pi25", "pc1").containsEntry("pi34", "pc2")
                .containsEntry("pi35", "pc3");
        return result;
    }

    private Map<String, String> strings(JsonNode values) {
        Map<String, String> result = new HashMap<>();
        values.properties().forEach(entry -> result.put(entry.getKey(), entry.getValue().asString()));
        return Map.copyOf(result);
    }

    private GenerateInput.PoolItem generatorItem(String id, String category, String priority,
            int pages, String askedAt) {
        return new GenerateInput.PoolItem(new Iteration(id, "D1", 1, "R1", category, priority,
                null, "Ready", null, null), pages, askedAt);
    }

    private JsonNode scenario(JsonNode recording, String name) {
        for (JsonNode candidate : recording.path("scenarios")) {
            if (name.equals(candidate.path("name").asString())) {
                return candidate;
            }
        }
        throw new AssertionError("No recorded scenario " + name);
    }

    private void verifySigned(Path path) throws IOException {
        try (JarFile jar = new JarFile(path.toFile(), true)) {
            Enumeration<JarEntry> entries = jar.entries();
            while (entries.hasMoreElements()) {
                JarEntry entry = entries.nextElement();
                if (entry.isDirectory()) {
                    continue;
                }
                if (entry.getName().equalsIgnoreCase("META-INF/MANIFEST.MF")
                        || entry.getName().matches("(?i)META-INF/[^/]+\\.(SF|RSA|DSA|EC)")) {
                    continue;
                }
                try (InputStream input = jar.getInputStream(entry)) {
                    input.readAllBytes();
                }
                assertThat(entry.getCertificates()).as(entry.getName()).isNotEmpty();
            }
        }
    }

    private record TestContext(String instanceId, Map<String, String> configuration,
            LocalPasswords localPasswords) implements PluginContext {
        @Override
        public Map<String, String> secrets() { return Map.of(); }

        @Override
        public PluginHttp http() {
            return request -> new PluginHttp.Response(500, Map.of(), new byte[0]);
        }

        @Override
        public System.Logger logger() { return System.getLogger("test"); }

        @Override
        public Clock clock() { return Clock.systemUTC(); }
    }
}
