package cz.mzk.vera.pluginhost;

import java.util.Map;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

// JARs kept in the database and upload come with Plugins' upload (B6 Signed), after step 2.
@Component
public class InstalledPlugins implements AutoCloseable {
    private final PluginLoader loader;
    private final Map<String, PluginLoader.LoadedPlugin> versions = new ConcurrentHashMap<>();

    public InstalledPlugins(PluginLoader loader) {
        this.loader = loader;
    }

    public synchronized PluginLoader.LoadedPlugin install(byte[] jar) {
        String digest;
        try {
            digest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(jar));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
        PluginLoader.LoadedPlugin existing = versions.get(digest);
        if (existing != null) {
            return existing;
        }
        PluginLoader.LoadedPlugin plugin = loader.load(jar);
        PluginLoader.LoadedPlugin old = versions.putIfAbsent(digest, plugin);
        if (old != null) {
            plugin.close();
            return old;
        }
        return plugin;
    }

    public PluginLoader.LoadedPlugin find(String descriptor, String version) {
        return versions.values().stream().filter(plugin -> plugin.descriptorId().equals(descriptor)
                && plugin.version().equals(version)).findFirst().orElse(null);
    }

    public synchronized void unload(String descriptor, String version) {
        versions.entrySet().removeIf(entry -> {
            PluginLoader.LoadedPlugin plugin = entry.getValue();
            if (plugin.descriptorId().equals(descriptor) && plugin.version().equals(version)) {
                plugin.close();
                return true;
            }
            return false;
        });
    }

    @Override
    public void close() {
        versions.values().forEach(PluginLoader.LoadedPlugin::close);
        versions.clear();
    }
}
