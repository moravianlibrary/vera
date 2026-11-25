package cz.mzk.vera.pluginhost;

// PLG-api-session: opens the transport of a new session, so each instance keeps its own connections.
public interface PluginTransports {
    PluginTransport open();
}
