package cz.mzk.vera.pluginhost;

import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.PluginUnavailable;
import java.time.Duration;

// PLG-api-session: how one session's requests leave VERA; a session opens its own.
public interface PluginTransport {
    PluginHttp.Response send(PluginHttp.Request request, Duration timeout) throws PluginUnavailable;
}
