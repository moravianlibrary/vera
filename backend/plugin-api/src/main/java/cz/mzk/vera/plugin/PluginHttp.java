package cz.mzk.vera.plugin;

import java.net.URI;
import java.util.List;
import java.util.Map;

// PLG-api-call.
public interface PluginHttp {
    Response send(Request request) throws PluginUnavailable;

    record Request(String method, URI uri, Map<String, List<String>> headers, byte[] body) {}

    record Response(int status, Map<String, List<String>> headers, byte[] body) {}
}
