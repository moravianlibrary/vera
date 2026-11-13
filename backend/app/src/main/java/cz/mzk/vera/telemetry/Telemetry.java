package cz.mzk.vera.telemetry;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.propagation.TextMapGetter;
import io.opentelemetry.context.propagation.TextMapSetter;
import io.opentelemetry.context.propagation.TextMapPropagator;
import java.util.Map;

// OBS-who; OBS-trace-through. Provides no-op spans when the agent is absent.
public final class Telemetry {
    private static final TextMapSetter<Map<String, String>> SETTER = Map::put;
    private static final TextMapGetter<Map<String, String>> GETTER = new TextMapGetter<>() {
        @Override
        @SuppressWarnings("deprecation")
        public Iterable<String> keys(Map<String, String> carrier) {
            return carrier.keySet();
        }

        @Override
        public String get(Map<String, String> carrier, String key) {
            return carrier.get(key);
        }
    };

    private Telemetry() { }

    public static String traceParent() {
        Map<String, String> carrier = new java.util.HashMap<>();
        GlobalOpenTelemetry.getPropagators().getTextMapPropagator()
                .inject(Context.current(), carrier, SETTER);
        return carrier.get("traceparent");
    }

    public static void setAct(Span span, String act, String userId, boolean reader) {
        span.setAttribute("vera.act", act);
        if (!reader) {
            span.setAttribute("vera.user.id", userId);
        }
    }

    public static Span startPlugin(Tracer tracer, String instanceId, String pluginKind) {
        Span span = tracer.spanBuilder("plugin " + pluginKind).startSpan();
        span.setAttribute("vera.plugin.instance", instanceId);
        return span;
    }

    public static void finishPlugin(Span span, String outcome) {
        span.setAttribute("vera.plugin.outcome", outcome);
        span.end();
    }

    public static Span startJob(String kind, String traceParent) {
        return startJob(GlobalOpenTelemetry.getTracer("vera-backend"),
                GlobalOpenTelemetry.getPropagators().getTextMapPropagator(), kind, traceParent);
    }

    public static Span startJob(Tracer tracer, TextMapPropagator propagator, String kind, String traceParent) {
        Context parent = traceParent == null ? Context.current()
                : propagator.extract(Context.root(), Map.of("traceparent", traceParent), GETTER);
        return tracer
                .spanBuilder("job " + kind)
                .setParent(parent)
                .setSpanKind(SpanKind.INTERNAL)
                .startSpan()
                .setAttribute("vera.job.kind", kind);
    }

    public static void finish(Span span, Throwable failure) {
        if (failure != null) {
            span.setStatus(StatusCode.ERROR);
        }
        span.end();
    }
}
