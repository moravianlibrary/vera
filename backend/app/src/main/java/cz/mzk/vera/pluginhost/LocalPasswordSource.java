package cz.mzk.vera.pluginhost;

import cz.mzk.vera.plugin.LocalPasswords;

// B9. Plugins receive only the local password check scoped to their instance.
public interface LocalPasswordSource {
    LocalPasswords forInstance(String instanceId);
}
