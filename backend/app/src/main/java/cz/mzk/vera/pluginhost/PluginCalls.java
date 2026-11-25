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
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.BiFunction;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import io.micrometer.observation.Observation;
import io.micrometer.observation.ObservationRegistry;
import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.Scope;
import cz.mzk.vera.telemetry.Telemetry;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// B6; PLG-api-call; PLG-api-session; PLG-api-outcome; PLG-secrets.
@Component
public class PluginCalls {
    private static final Logger LOGGER = LoggerFactory.getLogger(PluginCalls.class);
    private static final Duration PLUGIN_TIMEOUT = Duration.ofSeconds(10); // 10 seconds is a placeholder.
    private static final Pattern TIMEOUT = Pattern.compile("^(\\d+)(ms|s|m)$");

    private final DSLContext dsl;
    private final InstalledPlugins installed;
    private final PluginSessions sessions;
    private final Clock clock;
    private final ObservationRegistry observations;
    private final LocalPasswordSource localPasswords;
    private final Duration timeout;
    private final ObjectMapper mapper = new ObjectMapper();

    @Autowired
    public PluginCalls(DSLContext dsl, InstalledPlugins installed, PluginSessions sessions, Clock clock,
            ObservationRegistry observations, LocalPasswordSource localPasswords) {
        this(dsl, installed, sessions, clock, observations, localPasswords, PLUGIN_TIMEOUT);
    }

    PluginCalls(DSLContext dsl, InstalledPlugins installed, PluginSessions sessions, Clock clock,
            ObservationRegistry observations, LocalPasswordSource localPasswords, Duration timeout) {
        this.dsl = dsl;
        this.installed = installed;
        this.sessions = sessions;
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
        return call(source, instanceId, kind, operation, null, body);
    }

    public <K, A> PluginOutcome<A> call(DSLContext source, String instanceId, Class<K> kind,
            String operation, Duration callTimeout, BiFunction<K, PluginContext, A> body) {
        String kindName = kind.getSimpleName();
        Observation observation = Observation.createNotStarted("vera.plugin.call", observations)
                .lowCardinalityKeyValue("kind", kindName)
                .lowCardinalityKeyValue("operation", operation)
                .lowCardinalityKeyValue("instance", instanceId);
        String result = "unavailable";
        Span span = Telemetry.startPlugin(GlobalOpenTelemetry.getTracer("vera-backend"), instanceId, kindName);
        Scope spanScope = span.makeCurrent();
        observation.start();
        try {
            Record row = source.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.CONFIGURATION, PLUGIN_INSTANCES.REQUEST_LIMIT,
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

            Duration instanceTimeout = configuredTimeout(values, timeout);
            AtomicLong waited = new AtomicLong();
            JsonNode limit = row.get(PLUGIN_INSTANCES.REQUEST_LIMIT) == null ? null
                    : mapper.readTree(row.get(PLUGIN_INSTANCES.REQUEST_LIMIT).data());
            PluginHttp http = sessions.http(instanceId, RequestLimit.of(limit), instanceTimeout, waited);
            PluginContext context = new CallContext(
                    instanceId, Map.copyOf(configuration), Map.copyOf(secrets), http, clock,
                    localPasswords.forInstance(instanceId));
            K implementation = kind.cast(plugin.implementation());
            A answer = invoke(plugin, implementation, context,
                    callTimeout == null ? instanceTimeout : callTimeout, waited, body);
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
            // OBS-who: the class says what failed; its message may carry record contents.
            LOGGER.error("Plugin fault instance={} kind={} operation={} fault={}",
                    instanceId, kindName, operation, fault.getClass().getName());
            return new PluginOutcome.Unavailable<>(fault.getMessage());
        } finally {
            observation.lowCardinalityKeyValue("outcome", result).stop();
            Telemetry.finishPlugin(span, result);
            spanScope.close();
        }
    }

    // An instance's own timeout setting, else the host's default for every call.
    static Duration configuredTimeout(JsonNode values, Duration fallback) {
        JsonNode configured = values.get("timeout");
        if (configured == null || !configured.isString()) return fallback;
        Matcher matcher = TIMEOUT.matcher(configured.asString());
        if (!matcher.matches()) return fallback;
        long amount;
        try {
            amount = Long.parseLong(matcher.group(1));
        } catch (NumberFormatException invalid) {
            return fallback;
        }
        return switch (matcher.group(2)) {
            case "ms" -> Duration.ofMillis(amount);
            case "s" -> Duration.ofSeconds(amount);
            case "m" -> Duration.ofMinutes(amount);
            default -> fallback;
        };
    }

    private <K, A> A invoke(PluginLoader.LoadedPlugin plugin, K implementation,
            PluginContext context, Duration callTimeout, AtomicLong waited, BiFunction<K, PluginContext, A> body)
            throws InterruptedException, TimeoutException, PluginUnavailable {
        var executor = Executors.newVirtualThreadPerTaskExecutor();
        try {
            var future = executor.submit(Context.current().wrap(() -> {
                Thread.currentThread().setContextClassLoader(plugin.classLoader());
                return body.apply(implementation, context);
            }));
            try {
                return await(future, callTimeout, waited);
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

    static <A> A await(Future<A> future, Duration callTimeout)
            throws InterruptedException, ExecutionException, TimeoutException {
        return await(future, callTimeout, new AtomicLong());
    }

    // PLG-api-session: what the call waited for its session's room is added to its timeout.
    static <A> A await(Future<A> future, Duration callTimeout, AtomicLong waited)
            throws InterruptedException, ExecutionException, TimeoutException {
        long deadline = System.nanoTime() + callTimeout.toNanos();
        long counted = 0;
        while (true) {
            try {
                return future.get(Math.max(0, deadline - System.nanoTime()), TimeUnit.NANOSECONDS);
            } catch (TimeoutException timedOut) {
                long now = waited.get();
                if (now > counted) {
                    deadline += now - counted;
                    counted = now;
                    continue;
                }
                future.cancel(true);
                throw timedOut;
            }
        }
    }

    private <A> PluginOutcome<A> unavailable(String instance, String kind, String operation) {
        LOGGER.warn("Plugin unavailable instance={} kind={} operation={}", instance, kind, operation);
        return new PluginOutcome.Unavailable<>("Plugin unavailable.");
    }

    private record CallContext(String instanceId, Map<String, String> configuration,
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
