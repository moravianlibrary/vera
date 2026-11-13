package cz.mzk.vera.otel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import io.opentelemetry.api.trace.Span;
import io.opentelemetry.sdk.testing.exporter.InMemorySpanExporter;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.SimpleSpanProcessor;
import org.junit.jupiter.api.Test;

class AllowListExtensionTests {
    @Test
    void removesUnlistedSpanAttributesAndKeepsAllowedAttributes() {
        InMemorySpanExporter exporter = InMemorySpanExporter.create();
        SdkTracerProvider provider = SdkTracerProvider.builder()
                .addSpanProcessor(SimpleSpanProcessor.create(exporter))
                .build();
        Span span = provider.get("test").spanBuilder("request").startSpan();
        span.setAttribute("http.route", "/api/items/{id}");
        span.setAttribute("email", "person@example.org");
        span.end();

        var filtered = AllowListExtension.filterSpanData(exporter.getFinishedSpanItems().getFirst());

        assertEquals("/api/items/{id}", filtered.getAttributes().get(
                io.opentelemetry.api.common.AttributeKey.stringKey("http.route")));
        assertNull(filtered.getAttributes().get(io.opentelemetry.api.common.AttributeKey.stringKey("email")));
        provider.close();
    }
}
