package cz.mzk.vera.testing.fakes;

import cz.mzk.vera.pluginhost.PluginTransport;
import cz.mzk.vera.pluginhost.PluginTransports;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

// PLG-api-session; the test profile's sessions all reach the in-process fakes, which answer at once.
@Component
@Profile("test")
public class FakeWorldTransports implements PluginTransports {
    private final FakeWorldHttp http;

    public FakeWorldTransports(FakeWorldHttp http) {
        this.http = http;
    }

    @Override
    public PluginTransport open() {
        return (request, timeout) -> http.send(request);
    }
}
