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
import cz.mzk.vera.plugin.input.EntryLinkInput;
import cz.mzk.vera.plugin.input.EntryLinkInput.CatalogId;
import cz.mzk.vera.plugin.message.HandOffAnswer;
import cz.mzk.vera.plugin.message.HandOffInput;
import cz.mzk.vera.plugin.message.Message;
import cz.mzk.vera.plugin.propertysource.PropertySource;
import cz.mzk.vera.plugin.propertysource.ValuesAnswer;
import cz.mzk.vera.plugin.propertysource.ValuesInput;
import cz.mzk.vera.plugin.records.Document;
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
                    new Request("r1", "d1", null, null, null, null, null, null, null),
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
    }

    private Map<String, JsonNode> configurations(JsonNode seed) {
        Map<String, JsonNode> result = new HashMap<>();
        for (JsonNode instance : seed.path("collections").path("pluginInstances")) {
            String id = instance.path("id").asString();
            if ("pi24".equals(id) || "pi26".equals(id) || "pi31".equals(id) || "pi43".equals(id)) {
                result.put(id, instance.path("configuration"));
            }
        }
        assertThat(result).containsKeys("pi24", "pi26", "pi31", "pi43");
        return result;
    }

    private Map<String, String> strings(JsonNode values) {
        Map<String, String> result = new HashMap<>();
        values.properties().forEach(entry -> result.put(entry.getKey(), entry.getValue().asString()));
        return Map.copyOf(result);
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
