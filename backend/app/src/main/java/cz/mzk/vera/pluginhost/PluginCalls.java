package cz.mzk.vera.pluginhost;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.LocalPasswords;
import cz.mzk.vera.plugin.PluginRefused;
import cz.mzk.vera.plugin.PluginUnavailable;
import cz.mzk.vera.pluginhost.InstalledPlugins;
import cz.mzk.vera.pluginhost.PluginLoader;
import java.time.Clock;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.BiFunction;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import io.micrometer.observation.Observation;
import io.micrometer.observation.ObservationRegistry;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// B6; PLG-api-call; PLG-api-outcome; PLG-secrets.
@Component
public class PluginCalls {
    private static final Logger LOGGER = LoggerFactory.getLogger(PluginCalls.class);
    private static final Duration PLUGIN_TIMEOUT = Duration.ofSeconds(10); // 10 seconds is a placeholder, as the session limits are.

    private final DSLContext dsl;
    private final InstalledPlugins installed;
    private final PluginHttp http;
    private final Clock clock;
    private final ObservationRegistry observations;
    private final LocalPasswordSource localPasswords;
    private final Duration timeout;
    private final ObjectMapper mapper = new ObjectMapper();

    @Autowired
    public PluginCalls(DSLContext dsl, InstalledPlugins installed, PluginHttp http, Clock clock,
            ObservationRegistry observations, LocalPasswordSource localPasswords) {
        this(dsl, installed, http, clock, observations, localPasswords, PLUGIN_TIMEOUT);
    }

    PluginCalls(DSLContext dsl, InstalledPlugins installed, PluginHttp http, Clock clock,
            ObservationRegistry observations, LocalPasswordSource localPasswords, Duration timeout) {
        this.dsl = dsl;
        this.installed = installed;
        this.http = http;
        this.clock = clock;
        this.observations = observations;
        this.localPasswords = localPasswords;
        this.timeout = timeout;
    }

    public <K, A> PluginOutcome<A> call(String instanceId, Class<K> kind, String operation,
            BiFunction<K, PluginContext, A> body) {
        return call(dsl, instanceId, kind, operation, body);
    }

    public <K, A> PluginOutcome<A> call(DSLContext source, String instanceId, Class<K> kind,
            String operation, BiFunction<K, PluginContext, A> body) {
        return call(source, instanceId, kind, operation, timeout, body);
    }

    public <K, A> PluginOutcome<A> call(DSLContext source, String instanceId, Class<K> kind,
            String operation, Duration callTimeout, BiFunction<K, PluginContext, A> body) {
        String kindName = kind.getSimpleName();
        Observation observation = Observation.createNotStarted("vera.plugin.call", observations)
                .lowCardinalityKeyValue("kind", kindName)
                .lowCardinalityKeyValue("operation", operation)
                .lowCardinalityKeyValue("instance", instanceId);
        String result = "unavailable";
        observation.start();
        try {
            Record row = source.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.CONFIGURATION,
                            PLUGIN_IMPLEMENTATIONS.DESCRIPTOR_ID, PLUGIN_IMPLEMENTATIONS.VERSIONS)
                    .from(PLUGIN_INSTANCES)
                    .join(PLUGIN_IMPLEMENTATIONS)
                    .on(PLUGIN_INSTANCES.IMPLEMENTATION_ID.eq(PLUGIN_IMPLEMENTATIONS.ID))
                    .where(PLUGIN_INSTANCES.ID.eq(instanceId)
                            .and(PLUGIN_INSTANCES.IS_ENABLED.isTrue())
                            .and(PLUGIN_INSTANCES.IS_DELETED.isFalse()))
                    .fetchOne();
            if (row == null) {
                return unavailable(instanceId, kindName, operation);
            }

            JsonNode versions = mapper.readTree(row.get(PLUGIN_IMPLEMENTATIONS.VERSIONS).data());
            String version = versions.isArray() && !versions.isEmpty()
                    ? versions.get(0).path("version").asString()
                    : "";
            PluginLoader.LoadedPlugin plugin = installed.find(
                    row.get(PLUGIN_IMPLEMENTATIONS.DESCRIPTOR_ID), version);
            if (plugin == null || kind != plugin.kind()) {
                return unavailable(instanceId, kindName, operation);
            }

            JsonNode declaration = plugin.declaration();
            Map<String, String> configuration = new HashMap<>();
            Map<String, String> secrets = new HashMap<>();
            JsonNode values = mapper.readTree(row.get(PLUGIN_INSTANCES.CONFIGURATION).data());
            for (JsonNode field : declaration.path("configFields")) {
                String key = field.path("key").asString();
                JsonNode value = values.get(key);
                if (value == null || value.isNull()) {
                    continue;
                }
                if (field.path("isSecret").asBoolean()) {
                    secrets.put(key, value.asString());
                } else {
                    configuration.put(key, value.asString());
                }
            }

            PluginContext context = new Context(
                    instanceId, Map.copyOf(configuration), Map.copyOf(secrets), http, clock,
                    localPasswords.forInstance(instanceId));
            K implementation = kind.cast(plugin.implementation());
            A answer = invoke(plugin, implementation, context, callTimeout, body);
            if (answer == null) {
                LOGGER.error("Plugin fault instance={} kind={} operation={} returned a null answer",
                        instanceId, kindName, operation);
                return new PluginOutcome.Unavailable<>("Plugin returned no answer.");
            }
            result = "answered";
            return new PluginOutcome.Answered<>(answer);
        } catch (PluginRefused refused) {
            result = "refused";
            return new PluginOutcome.Refused<>(refused.code(), refused.message());
        } catch (PluginUnavailable unavailable) {
            result = "unavailable";
            return new PluginOutcome.Unavailable<>(unavailable.getMessage());
        } catch (TimeoutException exception) {
            return unavailable(instanceId, kindName, operation);
        } catch (Throwable fault) {
            LOGGER.error("Plugin fault instance={} kind={} operation={}",
                    instanceId, kindName, operation, fault);
            return new PluginOutcome.Unavailable<>(fault.getMessage());
        } finally {
            observation.lowCardinalityKeyValue("outcome", result).stop();
        }
    }

    private <K, A> A invoke(PluginLoader.LoadedPlugin plugin, K implementation,
            PluginContext context, Duration callTimeout, BiFunction<K, PluginContext, A> body)
            throws InterruptedException, TimeoutException, PluginUnavailable {
        var executor = Executors.newVirtualThreadPerTaskExecutor();
        try {
            var future = executor.submit(() -> {
                Thread.currentThread().setContextClassLoader(plugin.classLoader());
                return body.apply(implementation, context);
            });
            try {
                return future.get(callTimeout.toMillis(), TimeUnit.MILLISECONDS);
            } catch (TimeoutException timedOut) {
                future.cancel(true);
                throw timedOut;
            } catch (ExecutionException failed) {
                Throwable cause = failed.getCause();
                if (cause instanceof RuntimeException runtime) {
                    throw runtime;
                }
                if (cause instanceof Error error) {
                    throw error;
                }
                throw new PluginUnavailable("Plugin call failed.", cause);
            }
        } finally {
            executor.shutdownNow();
        }
    }

    private <A> PluginOutcome<A> unavailable(String instance, String kind, String operation) {
        LOGGER.warn("Plugin unavailable instance={} kind={} operation={}", instance, kind, operation);
        return new PluginOutcome.Unavailable<>("Plugin unavailable.");
    }

    private record Context(String instanceId, Map<String, String> configuration,
            Map<String, String> secrets, PluginHttp http, Clock clock,
            LocalPasswords localPasswords) implements PluginContext {
        @Override
        public System.Logger logger() {
            return System.getLogger("vera.plugin." + instanceId);
        }

        @Override
        public LocalPasswords localPasswords() {
            return localPasswords;
        }
    }
}
