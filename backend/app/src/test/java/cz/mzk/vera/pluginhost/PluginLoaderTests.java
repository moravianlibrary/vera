package cz.mzk.vera.pluginhost;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.catalog.CatalogAdapter;
import cz.mzk.vera.plugin.identity.CompleteAnswer;
import cz.mzk.vera.plugin.identity.CompleteInput;
import cz.mzk.vera.plugin.identity.Identity;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.jar.JarEntry;
import java.util.jar.JarOutputStream;
import javax.tools.ToolProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PluginLoaderTests {
    private static final String SERVICE_PATH = "META-INF/services/" + Identity.class.getName();
    private static final String DECLARATION_PATH = "META-INF/vera-plugin.json";

    @TempDir
    Path tempDir;

    private final PluginLoader loader = new PluginLoader(
            new PluginDeclarations(System.getenv("VERA_CONTRACT_DIR")));

    @Test
    void loadsSameClassNameFromTwoPluginJarsSideBySide() throws Exception {
        PluginLoader.LoadedPlugin first = load(standardDeclaration(),
                Map.of("test.IdentityImpl", source("one", false)), "test.IdentityImpl");
        PluginLoader.LoadedPlugin second = load(standardDeclaration(),
                Map.of("test.IdentityImpl", source("two", false)), "test.IdentityImpl");
        try {
            assertThat(first.implementation().getClass().getName())
                    .isEqualTo(second.implementation().getClass().getName());
            assertThat(first.implementation().getClass()).isNotSameAs(second.implementation().getClass());
            assertThat(complete(first)).extracting(CompleteAnswer::name).isEqualTo("one");
            assertThat(complete(second)).extracting(CompleteAnswer::name).isEqualTo("two");
            assertThat(first.classLoader().loadClass(PluginContext.class.getName()))
                    .isSameAs(PluginContext.class);
        } finally {
            first.close();
            second.close();
        }
    }

    @Test
    void pluginCannotLoadSpringClassThatIsOnlyInTheParent() throws Exception {
        PluginLoader.LoadedPlugin plugin = load(standardDeclaration(),
                Map.of("test.IdentityImpl", source("one", true)), "test.IdentityImpl");
        try {
            assertThatThrownBy(() -> identity(plugin).begin(null, null))
                    .isInstanceOf(IllegalStateException.class)
                    .hasCauseInstanceOf(ClassNotFoundException.class);
            assertThat(plugin.classLoader().loadClass(PluginContext.class.getName()))
                    .isSameAs(PluginContext.class);
        } finally {
            plugin.close();
        }
    }

    @Test
    void refusesJarWithoutDeclarations() throws Exception {
        byte[] jar = createJar(Map.of(SERVICE_PATH, "test.IdentityImpl"),
                Map.of("test.IdentityImpl", source("one", false)));
        assertRefused(jar, "no META-INF/vera-plugin.json");
    }

    @Test
    void refusesDeclarationsOutsideSchema() throws Exception {
        String declaration = standardDeclaration().replace("\"version\":\"1.0.0\",", "");
        byte[] jar = jar(declaration, "test.IdentityImpl", Map.of("test.IdentityImpl", source("one", false)));
        assertRefused(jar, "version");
    }

    @Test
    void refusesContractVersionTwo() throws Exception {
        String declaration = standardDeclaration().replace("\"contractVersion\":\"1.0\"", "\"contractVersion\":\"2.0\"");
        assertRefused(jar(declaration, "test.IdentityImpl", Map.of("test.IdentityImpl", source("one", false))),
                "unsupported contract version");
    }

    @Test
    void refusesIdentityWithoutServiceFile() throws Exception {
        byte[] jar = createJar(Map.of(DECLARATION_PATH, standardDeclaration()),
                Map.of("test.IdentityImpl", source("one", false)));
        assertRefused(jar, "service file for exactly one kind");
    }

    @Test
    void refusesTwoServiceImplementations() throws Exception {
        Map<String, String> sources = new HashMap<>();
        sources.put("test.IdentityImpl", source("one", false));
        sources.put("test.OtherIdentityImpl", source("two", false).replace("IdentityImpl", "OtherIdentityImpl"));
        assertRefused(jar(standardDeclaration(), "test.IdentityImpl\ntest.OtherIdentityImpl", sources),
                "found 2");
    }

    @Test
    void refusesIdentityDeclaringSearch() throws Exception {
        String declaration = standardDeclaration().replace("\"operations\":[]", "\"operations\":[\"search\"]");
        assertRefused(jar(declaration, "test.IdentityImpl", Map.of("test.IdentityImpl", source("one", false))),
                "declared operations do not match");
    }

    @Test
    void refusesCatalogDeclaringAnUnimplementedOptionalOperation() throws Exception {
        String service = "META-INF/services/" + CatalogAdapter.class.getName();
        String declaration = """
                {"implementation":"test.catalog","version":"1.0.0","contractVersion":"1.0",
                "triggers":["OnDemand"],"declares":{"operations":["readLink"],"properties":[],
                "identifierTypes":[],"rawStates":[],"rules":[],"agent":null,"generatorClass":null,
                "channelInterface":null,"loginEntry":null},"configFields":[]}
                """;
        String source = """
                package test;
                import cz.mzk.vera.plugin.PluginContext;
                import cz.mzk.vera.plugin.catalog.CatalogAdapter;
                import cz.mzk.vera.plugin.catalog.ReadAnswer;
                import cz.mzk.vera.plugin.catalog.ReadInput;
                public final class CatalogImpl implements CatalogAdapter {
                    public ReadAnswer read(PluginContext context, ReadInput input) { return null; }
                }
                """;
        assertRefused(createJar(Map.of(DECLARATION_PATH, declaration, service, "test.CatalogImpl"),
                Map.of("test.CatalogImpl", source)), "declared operations do not match");
    }

    @Test
    void refusesIdentityWithoutLoginEntry() throws Exception {
        String declaration = standardDeclaration().replace("\"loginEntry\":\"Form\"", "\"loginEntry\":null");
        assertRefused(jar(declaration, "test.IdentityImpl", Map.of("test.IdentityImpl", source("one", false))),
                "loginEntry must not be null");
    }

    @Test
    void cachesAPluginJarByContentAndClearsTheCacheWhenTheLoaderStarts() throws Exception {
        Path cache = Files.createDirectories(tempDir.resolve("plugin-cache"));
        Files.writeString(cache.resolve("old.jar"), "stale");
        PluginLoader cachedLoader = new PluginLoader(
                new PluginDeclarations(System.getenv("VERA_CONTRACT_DIR")), cache.toString());
        assertThat(Files.list(cache).toList()).isEmpty();
        InstalledPlugins installed = new InstalledPlugins(cachedLoader);
        byte[] jar = jar(standardDeclaration(), "test.IdentityImpl",
                Map.of("test.IdentityImpl", source("one", false)));
        PluginLoader.LoadedPlugin first = installed.install(jar);
        PluginLoader.LoadedPlugin second = installed.install(jar);
        assertThat(second).isSameAs(first);
        assertThat(Files.list(cache).filter(path -> path.toString().endsWith(".jar")).count()).isEqualTo(1);
        installed.close();
        new PluginLoader(new PluginDeclarations(System.getenv("VERA_CONTRACT_DIR")), cache.toString());
        assertThat(Files.list(cache).toList()).isEmpty();
    }

    private CompleteAnswer complete(PluginLoader.LoadedPlugin plugin) {
        return identity(plugin).complete(null, new CompleteInput.Form("user", "password"));
    }

    private Identity identity(PluginLoader.LoadedPlugin plugin) {
        return Identity.class.cast(plugin.implementation());
    }

    private PluginLoader.LoadedPlugin load(String declaration, Map<String, String> sources, String services)
            throws Exception {
        return loader.load(jar(declaration, services, sources));
    }

    private void assertRefused(byte[] jar, String reason) {
        assertThatThrownBy(() -> loader.load(jar))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(reason);
    }

    private String standardDeclaration() {
        return """
                {"implementation":"test.identity","version":"1.0.0","contractVersion":"1.0",
                "triggers":["OnLogin"],"declares":{"operations":[],"properties":[],"identifierTypes":[],
                "rawStates":[],"rules":[],"agent":null,"generatorClass":null,"channelInterface":null,
                "loginEntry":"Form"},"configFields":[]}
                """;
    }

    private byte[] jar(String declaration, String services, Map<String, String> sources) throws Exception {
        Map<String, String> entries = new HashMap<>();
        entries.put(DECLARATION_PATH, declaration);
        entries.put(SERVICE_PATH, services);
        return createJar(entries, sources);
    }

    private byte[] createJar(Map<String, String> entries, Map<String, String> sources) throws Exception {
        Path sourceDir = Files.createDirectories(tempDir.resolve("src-" + System.nanoTime()));
        Path classesDir = Files.createDirectories(tempDir.resolve("classes-" + System.nanoTime()));
        List<Path> sourceFiles = writeSources(sourceDir, sources);
        compile(sourceFiles, classesDir);

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (JarOutputStream output = new JarOutputStream(bytes)) {
            for (Map.Entry<String, String> entry : entries.entrySet()) {
                add(output, entry.getKey(), entry.getValue().getBytes(StandardCharsets.UTF_8));
            }
            try (var files = Files.walk(classesDir)) {
                for (Path file : files.filter(Files::isRegularFile).toList()) {
                    String name = classesDir.relativize(file).toString().replace('\\', '/');
                    add(output, name, Files.readAllBytes(file));
                }
            }
        }
        return bytes.toByteArray();
    }

    private List<Path> writeSources(Path sourceDir, Map<String, String> sources) throws IOException {
        List<Path> files = new ArrayList<>();
        for (Map.Entry<String, String> source : sources.entrySet()) {
            Path file = sourceDir.resolve(source.getKey().replace('.', '/') + ".java");
            Files.createDirectories(file.getParent());
            Files.writeString(file, source.getValue());
            files.add(file);
        }
        return files;
    }

    private void compile(List<Path> sources, Path classesDir) throws Exception {
        var compiler = ToolProvider.getSystemJavaCompiler();
        assertThat(compiler).isNotNull();
        String apiClasses = Path.of(Identity.class.getProtectionDomain().getCodeSource().getLocation().toURI())
                .toString();
        String classpath = System.getProperty("java.class.path") + System.getProperty("path.separator") + apiClasses;
        List<String> arguments = new ArrayList<>(List.of("-classpath", classpath, "-d", classesDir.toString()));
        sources.forEach(source -> arguments.add(source.toString()));
        int result = compiler.run(null, null, null, arguments.toArray(String[]::new));
        assertThat(result).isZero();
    }

    private String source(String name, boolean lookForSpring) {
        String beginBody = lookForSpring
                ? "try { Class.forName(\"org.springframework.context.ApplicationContext\"); } "
                        + "catch (ClassNotFoundException error) { throw new IllegalStateException(error); }"
                : "return new BeginAnswer(null);";
        if (lookForSpring) {
            beginBody += " return new BeginAnswer(null);";
        }
        return """
                package test;
                import cz.mzk.vera.plugin.PluginContext;
                import cz.mzk.vera.plugin.identity.BeginAnswer;
                import cz.mzk.vera.plugin.identity.BeginInput;
                import cz.mzk.vera.plugin.identity.CompleteAnswer;
                import cz.mzk.vera.plugin.identity.CompleteInput;
                import cz.mzk.vera.plugin.identity.Identity;
                import java.util.List;
                public final class IdentityImpl implements Identity {
                    public BeginAnswer begin(PluginContext context, BeginInput input) {
                        %s
                    }
                    public CompleteAnswer complete(PluginContext context, CompleteInput input) {
                        return new CompleteAnswer("id", null, false, "%s", List.of());
                    }
                }
                """.formatted(beginBody, name);
    }

    private void add(JarOutputStream output, String name, byte[] content) throws IOException {
        output.putNextEntry(new JarEntry(name));
        output.write(content);
        output.closeEntry();
    }
}
