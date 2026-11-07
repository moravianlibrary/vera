package cz.mzk.vera.pluginhost;

import cz.mzk.vera.plugin.ContractVersion;
import cz.mzk.vera.plugin.catalog.CatalogAdapter;
import cz.mzk.vera.plugin.catalog.ChangeFeed;
import cz.mzk.vera.plugin.catalog.LinkReader;
import cz.mzk.vera.plugin.catalog.MirroredCatalog;
import cz.mzk.vera.plugin.catalog.SearchableCatalog;
import cz.mzk.vera.plugin.classifier.Classifier;
import cz.mzk.vera.plugin.custody.Custody;
import cz.mzk.vera.plugin.identity.Identity;
import cz.mzk.vera.plugin.registry.Registry;
import cz.mzk.vera.plugin.propertysource.PropertySource;
import cz.mzk.vera.plugin.validation.Validation;
import cz.mzk.vera.plugin.restriction.Restriction;
import cz.mzk.vera.plugin.input.BarcodeReader;
import cz.mzk.vera.plugin.input.EntryLinkInput;
import cz.mzk.vera.plugin.input.Input;
import cz.mzk.vera.plugin.input.PhotoReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.ServiceConfigurationError;
import java.util.ServiceLoader;
import java.util.jar.JarEntry;
import java.util.jar.JarInputStream;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

// B6; PLG-api-capabilities.
@Component
public class PluginLoader {
    static final Map<Class<?>, Map<Class<?>, String>> OPTIONAL_OPERATIONS = Map.ofEntries(
            Map.entry(Identity.class, Map.of()),
            Map.entry(CatalogAdapter.class, Map.of(
                    LinkReader.class, "readLink",
                    SearchableCatalog.class, "search",
                    ChangeFeed.class, "changes",
                    MirroredCatalog.class, "sync")),
            Map.entry(Input.class, Map.of(
                    BarcodeReader.class, "readBarcode",
                    PhotoReader.class, "readPhoto",
                    EntryLinkInput.class, "entry")),
            Map.entry(Custody.class, Map.of()),
            Map.entry(Classifier.class, Map.of()),
            Map.entry(Registry.class, Map.of()),
            Map.entry(PropertySource.class, Map.of()),
            Map.entry(Validation.class, Map.of()),
            Map.entry(Restriction.class, Map.of()));

    private final PluginDeclarations declarations;

    public PluginLoader(PluginDeclarations declarations) {
        this.declarations = declarations;
    }

    public LoadedPlugin load(byte[] jar) {
        JsonNode declaration = declarations.read(jar);
        String descriptor = declaration.path("implementation").asString();
        String version = declaration.path("version").asString();
        if (!ContractVersion.accepts(declaration.path("contractVersion").asString())) {
            throw refused(descriptor, version, "unsupported contract version");
        }

        Class<?> kind = findKind(jar, descriptor, version);
        if (kind == Identity.class && declaration.path("declares").path("loginEntry").isNull()) {
            throw refused(descriptor, version, "Identity loginEntry must not be null");
        }

        PluginClassLoader loader = new PluginClassLoader(jar, PluginLoader.class.getClassLoader());
        List<Object> providers = loadProviders(kind, loader, descriptor, version);
        if (providers.size() != 1) {
            loader.closeQuietly();
            throw refused(descriptor, version, "expected exactly one service implementation, found " + providers.size());
        }

        Object implementation = providers.getFirst();
        try {
            checkOperations(kind, implementation, declaration, descriptor, version);
        } catch (RuntimeException exception) {
            loader.closeQuietly();
            throw exception;
        }
        return new LoadedPlugin(descriptor, version, declaration, loader, kind, implementation);
    }

    private Class<?> findKind(byte[] jar, String descriptor, String version) {
        List<Class<?>> matches = new ArrayList<>();
        try (JarInputStream archive = new JarInputStream(new ByteArrayInputStream(jar))) {
            JarEntry entry;
            while ((entry = archive.getNextJarEntry()) != null) {
                for (Class<?> kind : OPTIONAL_OPERATIONS.keySet()) {
                    String servicePath = "META-INF/services/" + kind.getName();
                    if (servicePath.equals(entry.getName())) {
                        matches.add(kind);
                    }
                }
            }
        } catch (IOException exception) {
            throw refused(descriptor, version, "could not read service declarations");
        }
        if (matches.size() != 1) {
            throw refused(descriptor, version, "expected a service file for exactly one kind, found " + matches.size());
        }
        return matches.getFirst();
    }

    private List<Object> loadProviders(Class<?> kind, PluginClassLoader loader, String descriptor, String version) {
        List<Object> providers = new ArrayList<>();
        try {
            ServiceLoader<?> services = ServiceLoader.load(kind, loader);
            services.forEach(providers::add);
        } catch (ServiceConfigurationError | RuntimeException exception) {
            loader.closeQuietly();
            throw refused(descriptor, version, "kind service could not be loaded");
        }
        return providers;
    }

    private void checkOperations(Class<?> kind, Object implementation, JsonNode declaration,
            String descriptor, String version) {
        Map<Class<?>, String> optional = OPTIONAL_OPERATIONS.get(kind);
        if (optional == null || !kind.isInstance(implementation)) {
            throw refused(descriptor, version, "implementation does not implement its kind interface");
        }

        List<String> declared = new ArrayList<>();
        declaration.path("declares").path("operations").forEach(value -> declared.add(value.asString()));
        List<String> implemented = optional.entrySet().stream()
                .filter(entry -> entry.getKey().isInstance(implementation))
                .map(Map.Entry::getValue)
                .sorted()
                .toList();
        declared.sort(String::compareTo);
        if (!declared.equals(implemented)) {
            throw refused(descriptor, version, "declared operations do not match implemented optional interfaces");
        }
    }

    private IllegalArgumentException refused(String descriptor, String version, String reason) {
        return new IllegalArgumentException("Plugin " + descriptor + " " + version + " refused: " + reason + ".");
    }

    public record LoadedPlugin(String descriptorId, String version, JsonNode declaration,
            PluginClassLoader classLoader, Class<?> kind, Object implementation) implements AutoCloseable {
        @Override
        public void close() {
            classLoader.closeQuietly();
        }
    }

    public static final class PluginClassLoader extends URLClassLoader {
        PluginClassLoader(byte[] bytes, ClassLoader parent) {
            super(new URL[0], parent);
            try {
                Path temp = Files.createTempFile("vera-plugin-", ".jar");
                Files.write(temp, bytes);
                addURL(temp.toUri().toURL());
                temp.toFile().deleteOnExit();
            } catch (IOException exception) {
                throw new IllegalArgumentException("Could not prepare plugin JAR.", exception);
            }
        }

        @Override
        protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
            synchronized (getClassLoadingLock(name)) {
                Class<?> loaded = findLoadedClass(name);
                if (loaded == null) {
                    if (parentFirst(name)) {
                        loaded = getParent().loadClass(name);
                    } else {
                        loaded = findClass(name);
                    }
                }
                if (resolve) {
                    resolveClass(loaded);
                }
                return loaded;
            }
        }

        private boolean parentFirst(String name) {
            return name.startsWith("cz.mzk.vera.plugin.")
                    || name.startsWith("java.")
                    || name.startsWith("javax.")
                    || name.startsWith("jdk.")
                    || name.startsWith("sun.");
        }

        void closeQuietly() {
            try {
                close();
            } catch (IOException ignored) {
                // Best effort after refusing a plugin JAR.
            }
        }
    }
}
