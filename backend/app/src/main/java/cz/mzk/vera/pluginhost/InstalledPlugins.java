package cz.mzk.vera.pluginhost;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

// JARs kept in the database and upload come with Plugins' upload (B6 Signed), after step 2.
@Component
public class InstalledPlugins implements AutoCloseable {
    private final PluginLoader loader;
    private final Map<Key, PluginLoader.LoadedPlugin> versions = new ConcurrentHashMap<>();

    public InstalledPlugins(PluginLoader loader) {
        this.loader = loader;
    }

    public PluginLoader.LoadedPlugin install(byte[] jar) {
        PluginLoader.LoadedPlugin plugin = loader.load(jar);
        Key key = new Key(plugin.descriptorId(), plugin.version());
        PluginLoader.LoadedPlugin old = versions.putIfAbsent(key, plugin);
        if (old != null) {
            plugin.close();
            return old;
        }
        return plugin;
    }

    public PluginLoader.LoadedPlugin find(String descriptor, String version) {
        return versions.get(new Key(descriptor, version));
    }

    @Override
    public void close() {
        versions.values().forEach(PluginLoader.LoadedPlugin::close);
        versions.clear();
    }

    private record Key(String descriptor, String version) {}
}
