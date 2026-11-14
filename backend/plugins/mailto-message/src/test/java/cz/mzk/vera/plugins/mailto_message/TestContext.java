package cz.mzk.vera.plugins.mailto_message;

import cz.mzk.vera.plugin.LocalPasswords;
import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginHttp;
import java.time.Clock;
import java.util.Map;

record TestContext(Map<String, String> configuration) implements PluginContext {
    @Override
    public String instanceId() {
        return "test";
    }

    @Override
    public Map<String, String> secrets() {
        return Map.of();
    }

    @Override
    public PluginHttp http() {
        return request -> new PluginHttp.Response(500, Map.of(), new byte[0]);
    }

    @Override
    public System.Logger logger() {
        return System.getLogger("test");
    }

    @Override
    public Clock clock() {
        return Clock.systemUTC();
    }

    @Override
    public LocalPasswords localPasswords() {
        return (username, password) -> null;
    }
}
