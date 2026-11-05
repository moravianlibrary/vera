package cz.mzk.vera.plugin;

import java.time.Clock;
import java.util.Map;

// PLG-api-call; PLG-secrets.
public interface PluginContext {
    String instanceId();

    Map<String, String> configuration();

    Map<String, String> secrets();

    PluginHttp http();

    System.Logger logger();

    Clock clock();

    LocalPasswords localPasswords();
}
