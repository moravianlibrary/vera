package cz.mzk.vera.telemetry;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.sdk.testing.exporter.InMemorySpanExporter;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.SimpleSpanProcessor;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.api.trace.propagation.W3CTraceContextPropagator;
import org.junit.jupiter.api.Test;

class TelemetryTests {
    @Test
    void jobRunKeepsTheTraceIdOfTheQueueingAct() {
        InMemorySpanExporter exporter = InMemorySpanExporter.create();
        SdkTracerProvider provider = SdkTracerProvider.builder()
                .addSpanProcessor(SimpleSpanProcessor.create(exporter))
                .build();
        Tracer tracer = provider.get("test");
        var act = tracer.spanBuilder("act").startSpan();
        String traceId = act.getSpanContext().getTraceId();
        String traceParent = "00-" + traceId + "-" + act.getSpanContext().getSpanId() + "-01";
        act.end();

        var job = Telemetry.startJob(tracer, W3CTraceContextPropagator.getInstance(), "ingest", traceParent);
        job.end();

        assertEquals(traceId, exporter.getFinishedSpanItems().get(1).getTraceId());
        provider.close();
    }

    @Test
    void recordsPluginInstanceAndOutcome() {
        InMemorySpanExporter exporter = InMemorySpanExporter.create();
        SdkTracerProvider provider = SdkTracerProvider.builder()
                .addSpanProcessor(SimpleSpanProcessor.create(exporter))
                .build();
        Tracer tracer = provider.get("test");
        var span = Telemetry.startPlugin(tracer, "PI-catalog", "CatalogAdapter");
        Telemetry.finishPlugin(span, "answered");

        var attributes = exporter.getFinishedSpanItems().getFirst().getAttributes();
        assertEquals("PI-catalog", attributes.get(AttributeKey.stringKey("vera.plugin.instance")));
        assertEquals("answered", attributes.get(AttributeKey.stringKey("vera.plugin.outcome")));
        provider.close();
    }

    @Test
    void addsUserIdForAnAdministratorsAct() {
        InMemorySpanExporter exporter = InMemorySpanExporter.create();
        SdkTracerProvider provider = SdkTracerProvider.builder()
                .addSpanProcessor(SimpleSpanProcessor.create(exporter))
                .build();
        var span = provider.get("test").spanBuilder("act").startSpan();
        Telemetry.setAct(span, "access.user_changed", "U-admin", false);
        span.end();

        var attributes = exporter.getFinishedSpanItems().getFirst().getAttributes();
        assertEquals("access.user_changed", attributes.get(AttributeKey.stringKey("vera.act")));
        assertEquals("U-admin", attributes.get(AttributeKey.stringKey("vera.user.id")));
        provider.close();
    }

    @Test
    void omitsUserIdForAReadersAct() {
        InMemorySpanExporter exporter = InMemorySpanExporter.create();
        SdkTracerProvider provider = SdkTracerProvider.builder()
                .addSpanProcessor(SimpleSpanProcessor.create(exporter))
                .build();
        var span = provider.get("test").spanBuilder("act").startSpan();
        Telemetry.setAct(span, "request.created", "U-reader", true);
        span.end();

        var attributes = exporter.getFinishedSpanItems().getFirst().getAttributes();
        assertEquals("request.created", attributes.get(AttributeKey.stringKey("vera.act")));
        assertNull(attributes.get(AttributeKey.stringKey("vera.user.id")));
        provider.close();
    }
}
